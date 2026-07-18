import os
import json
import asyncio
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.voice.events import (
    AgentStateChangedEvent,
    ConversationItemAddedEvent,
    ErrorEvent,
    UserInputTranscribedEvent,
    UserStateChangedEvent,
)
from livekit.plugins import deepgram, openai

# Load environment variables (Ensure you have GROQ_API_KEY and DEEPGRAM_API_KEY)
load_dotenv()
logger = logging.getLogger("voice-agent")
logger.setLevel(logging.INFO)

# Explicit-dispatch name. server.py dispatches this agent into a room and passes
# the meeting agenda as job metadata (see entrypoint). Because agent_name is set,
# the worker only joins rooms it is explicitly dispatched to.
AGENT_NAME = "meeting-agent"

# LiveKit data-channel topic the bridge publishes active-speaker updates on. The
# meeting participants aren't LiveKit participants (their audio is mixed into one
# bridge track), so LiveKit's own speaker events can't name them — the bridge
# relays Meeting BaaS's names here instead. Keep in sync with bridge.py.
ACTIVE_SPEAKERS_TOPIC = "active_speakers"

# LiveKit data-channel topic the agent uses to relay its OWN spoken lines to the
# bridge, which owns the transcript file. The bridge only transcribes the incoming
# meeting audio (the humans); the agent's TTS isn't in that stream, so without this
# relay the transcript would miss the facilitator's half. Keep in sync with bridge.py.
AGENT_TRANSCRIPT_TOPIC = "agent_transcript"

# Last-resort wait before greeting if neither the admission webhook nor any
# meeting audio has arrived. Kept short because the agent normally greets as soon
# as it hears the meeting audio track (see wait_until_admitted), and meetings are
# often only a couple of minutes long.
ADMISSION_TIMEOUT_S = 30

# Fallback agenda, used only when the dispatch carries no agenda (e.g. the agent
# is launched directly rather than through the frontend/server.py).
DEFAULT_AGENDA = [
    "Welcome everyone and ask each attendee to briefly introduce themselves.",
    "Ask what progress or updates each attendee has since the last meeting.",
    "Ask if there are any blockers or issues the team needs help with.",
    "Ask about the next steps or action items coming out of this discussion.",
    "Summarize the key points raised and thank everyone before wrapping up.",
]


def build_instructions(
    agenda: list[str], meeting_title: str | None, context: str | None = None
) -> str:
    """Build the agent's system prompt so it stays strictly on the given agenda."""
    title_line = f'This meeting is titled "{meeting_title}".\n' if meeting_title else ""
    numbered = "\n".join(f"{i + 1}. {item}" for i, item in enumerate(agenda))

    # Background goes AFTER the rules, framed as reference material. Two failure
    # modes to avoid: the model reading the brief aloud like a report, and the
    # model treating anything mentioned in it as fair game to discuss — which
    # would quietly undo the agenda-only restriction above.
    context_block = ""
    if context:
        context_block = (
            "\n\nBACKGROUND — what these attendees have been working on, from the "
            "team's task tracker:\n"
            + context
            + "\n\nHow to use the background:\n"
            "- Use it to ask specific, informed questions ('you finished the "
            "bridge — what's left?') instead of generic ones.\n"
            "- Use it to recognise work people have already completed.\n"
            "- NEVER read it aloud, summarize it unprompted, or recite lists from "
            "it. It is context for you, not a script.\n"
            "- It does NOT widen what you may discuss. The agenda above is still "
            "the only thing you may talk about.\n"
            "- It may be out of date or incomplete. If someone contradicts it, "
            "believe the person, not the background."
        )

    return (
        "You are an AI meeting facilitator joining a live call.\n"
        + title_line
        + "You may ONLY discuss the following agenda items, and nothing else:\n"
        + numbered
        + "\n\nStrict rules:\n"
        "- Only talk about the agenda above. Do NOT answer questions or hold "
        "conversation about any topic that is not one of these agenda items.\n"
        "- If a participant brings up something off-agenda, briefly and politely "
        "decline to discuss it and steer the conversation back to the current "
        "agenda item.\n"
        "- Work through the items in order, one at a time. Ask a single question "
        "at a time and wait for attendees to respond before moving on.\n"
        "- Keep every response short and conversational — this is spoken audio.\n"
        "- Each participant message may be prefixed with the speaker's name (e.g. "
        "'Alice said: ...'). Use it to address people by name naturally and to "
        "track who has already contributed. Never read the 'X said:' prefix aloud.\n"
        "- Once all agenda items are covered, briefly summarize the key points "
        "and thank everyone before wrapping up."
        + context_block
    )


class VoiceAgent(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(
            instructions=instructions,

            # 1. STT: Deepgram
            # vad_events=True makes Deepgram emit speech start/end events so
            # turn_detection="stt" below works without a separate VAD model.
            stt=deepgram.STT(
                model="nova-3",
                language="en-US",
                vad_events=True,
            ),

            # 2. LLM: Groq (using OpenAI plugin architecture)
            llm=openai.LLM(
                base_url="https://api.groq.com/openai/v1",
                api_key=os.environ.get("GROQ_API_KEY"),
                model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
            ),

            # 3. TTS: Deepgram
            tts=deepgram.TTS(
                model="aura-asteria-en"
            )
        )

        # Who Meeting BaaS currently reports as speaking, relayed from the bridge
        # over the LiveKit data channel (see entrypoint's data_received handler).
        # The humans aren't LiveKit participants, so this relay is the only way the
        # agent can attach real names to the single mixed track it hears.
        self._active_speakers: list[str] = []

    def set_active_speakers(self, names: list[str]) -> None:
        """Update the current active speaker(s) from a bridge relay message."""
        cleaned = [n.strip() for n in names if isinstance(n, str) and n.strip()]
        if cleaned != self._active_speakers:
            self._active_speakers = cleaned
            if cleaned:
                logger.info("Active speaker(s): %s", ", ".join(cleaned))

    @property
    def current_speaker(self) -> str | None:
        """The primary current speaker, or None if unknown."""
        return self._active_speakers[0] if self._active_speakers else None

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        """
        Attribute the just-finished utterance to whoever Meeting BaaS reports as
        speaking, so the LLM knows who it's talking to. Without this, every
        participant is indistinguishable on the single mixed audio track.

        We prefix the message the LLM sees with "<name> said:"; the prompt tells
        the model to use the name but never read the prefix aloud.
        """
        speaker = self.current_speaker
        text = new_message.text_content
        if speaker and text:
            new_message.content = [f"{speaker} said: {text}"]


def parse_agenda_metadata(raw_metadata: str) -> tuple[list[str], str | None, str | None]:
    """Extract (agenda, meeting_title, context) from the dispatch job metadata JSON."""
    if not raw_metadata:
        return DEFAULT_AGENDA, None, None
    try:
        meta = json.loads(raw_metadata)
    except json.JSONDecodeError:
        logger.warning("Could not parse job metadata as JSON: %r", raw_metadata)
        return DEFAULT_AGENDA, None, None

    agenda = [item.strip() for item in (meta.get("agenda") or []) if item and item.strip()]
    meeting_title = (meta.get("meeting_title") or "").strip() or None
    # Absent whenever the bot was launched without a generated context package
    # (the launcher frontend, trigger.py, or a bare dispatch all omit it).
    context = (meta.get("context") or "").strip() or None
    return (agenda or DEFAULT_AGENDA), meeting_title, context


def _is_admitted(metadata: str | None) -> bool:
    """True if room metadata signals the bot has been admitted into the call."""
    if not metadata:
        return False
    try:
        return bool(json.loads(metadata).get("admitted"))
    except json.JSONDecodeError:
        return False


def _room_has_audio(ctx: JobContext) -> bool:
    """True if any remote participant is already publishing an audio track."""
    for participant in ctx.room.remote_participants.values():
        for pub in participant.track_publications.values():
            if pub.track is not None and pub.track.kind == rtc.TrackKind.KIND_AUDIO:
                return True
    return False


async def wait_until_admitted(ctx: JobContext) -> None:
    """
    Block until the bot is actually in the call, then let it greet.

    Resolves on the FIRST of:
      - the meeting audio track being subscribed (the bridge only publishes audio
        once Meeting BaaS is streaming, i.e. the bot is in the call) — the
        reliable, self-contained signal;
      - room metadata {"admitted": true} (set by server.py from the Meeting BaaS
        'in_call_recording' webhook, when that webhook is configured);
      - a short ADMISSION_TIMEOUT_S fallback so a greeting still happens.
    """
    ready = asyncio.Event()

    @ctx.room.on("room_metadata_changed")
    def _on_room_metadata(_old: str, new_metadata: str):
        if _is_admitted(new_metadata):
            logger.info("Room metadata signals admission — the bot is in the call.")
            ready.set()

    @ctx.room.on("track_subscribed")
    def _on_track_subscribed(track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info("Meeting audio track subscribed — the bot can be heard now.")
            ready.set()

    # Either signal may already be true before these handlers were registered.
    if _is_admitted(ctx.room.metadata) or _room_has_audio(ctx):
        ready.set()

    if ready.is_set():
        return

    logger.info("Waiting for meeting audio (or admission) before speaking...")
    try:
        await asyncio.wait_for(ready.wait(), timeout=ADMISSION_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.warning(
            "No admission/audio signal after %ss — greeting anyway.", ADMISSION_TIMEOUT_S
        )


def _is_ended(metadata: str | None) -> bool:
    """True if room metadata signals the meeting/call has ended."""
    if not metadata:
        return False
    try:
        return bool(json.loads(metadata).get("ended"))
    except json.JSONDecodeError:
        return False


async def wait_until_ended(ctx: JobContext) -> None:
    """
    Block until the meeting is over, so the agent can leave on its own.

    Ends on the FIRST of:
      - the meeting bridge participant leaving the room — the reliable signal
        that Meeting BaaS disconnected the bot from the call (server.py closes
        the bridge when the Meeting BaaS socket drops);
      - room metadata {"ended": true} (set by server.py from the Meeting BaaS
        'call_ended'/'complete' webhook, when configured);
      - the LiveKit room connection itself dropping.
    """
    ended = asyncio.Event()

    @ctx.room.on("room_metadata_changed")
    def _on_room_metadata(_old: str, new_metadata: str):
        if _is_ended(new_metadata):
            logger.info("Room metadata signals the meeting has ended.")
            ended.set()

    @ctx.room.on("participant_disconnected")
    def _on_participant_disconnected(participant):
        # In this setup the only other participant is the meeting bridge, so its
        # departure means the bot has been disconnected from the meeting.
        logger.info(
            "Participant %s left — meeting bridge gone, ending.",
            getattr(participant, "identity", "?"),
        )
        ended.set()

    @ctx.room.on("disconnected")
    def _on_disconnected(*_args):
        logger.info("LiveKit room disconnected — treating the meeting as ended.")
        ended.set()

    # The end signal may already be present before these handlers were registered.
    if _is_ended(ctx.room.metadata):
        ended.set()

    if not ended.is_set():
        logger.info("Meeting in progress — waiting for the end signal to disconnect...")
        await ended.wait()


async def entrypoint(ctx: JobContext):
    # Connect to the LiveKit room the meeting-baas bridge publishes meeting audio into
    await ctx.connect()
    logger.info("Agent connected to room: %s", ctx.room.name)

    # Read the agenda passed from the frontend (server.py -> dispatch metadata).
    agenda, meeting_title, context = parse_agenda_metadata(ctx.job.metadata or "")
    logger.info("Using agenda (%d items, title=%r): %s", len(agenda), meeting_title, agenda)
    logger.info(
        "Context brief: %s",
        f"{len(context)} chars" if context else "none — running the agenda blind",
    )

    instructions = build_instructions(agenda, meeting_title, context)

    # Set up the session.
    # NOTE: transcript capture lives entirely in the bridge (server.py side) now,
    # so nothing here touches the STT/answering path.
    #
    # Turn-taking is tuned for a live, multi-party meeting where ALL participants
    # arrive on a single mixed audio track (the Meeting BaaS bridge), so the two
    # goals are: respond fast, but don't let one person's "mhm"/cough/side-comment
    # cut the agent off. See each block below.
    session = AgentSession(
        turn_handling={
            # End-of-turn from Deepgram's STT — no extra inference hop, so it's the
            # lowest-latency turn detector. (If you ever see the agent jumping in
            # while someone is mid-thought, drop this key to fall back to LiveKit
            # Cloud's semantic turn detector, which trades ~50-100ms for fewer
            # premature cut-ins.)
            "turn_detection": "stt",

            # How long to wait after speech stops before replying — the single
            # biggest lever on "why is it slow to answer". Preemptive LLM+TTS
            # already hides the model's ~0.2s TTFT, so this delay is essentially
            # the whole remaining wait. Pushed to a 0.1s floor (vs the 0.5s
            # default) for near-instant replies. "dynamic" still extends the wait
            # when your sentence sounds unfinished, so it won't chop you off as
            # hard as a fixed 0.1s would. If it DOES cut in on natural mid-sentence
            # pauses, raise min_delay toward 0.2-0.3.
            "endpointing": {"mode": "dynamic", "min_delay": 0.1, "max_delay": 1.5},

            # Barge-in: the agent yields when you speak, but must NOT abort its own
            # replies. On the single MIXED meeting track, pure-VAD interruption
            # (min_words=0) treats any sound — room noise, another participant, or
            # the bot's own audio echoing back — as an interruption and kills the
            # reply mid-sentence, so it looks like the bot "won't answer". Requiring
            # one real transcribed word fixes that while still stopping fast (~0.2-
            # 0.4s, the time to catch the first word). Mode is auto-selected
            # (adaptive backchannel suppression on LiveKit Cloud).
            #   - Still interrupts too eagerly?  -> min_words: 2
            #   - Testing SOLO with headphones (no echo) and want instant barge-in?
            #     -> min_words: 0, "mode": "vad"  (do NOT use that in a real call)
            "interruption": {"enabled": True, "min_duration": 0.3, "min_words": 1},

            # Start generating the reply on the *interim* transcript (already the
            # 1.6.5 default) AND pre-run TTS, so the first audio is ready the instant
            # the turn is confirmed instead of only starting synthesis then.
            "preemptive_generation": {"enabled": True, "preemptive_tts": True},
        }
    )

    # Diagnostics: log what the session actually sees, to tell apart "no audio
    # is arriving" from "audio arrives but turn-taking/LLM never fires".
    @session.on("user_input_transcribed")
    def _on_transcript(ev: UserInputTranscribedEvent):
        logger.info("STT transcript (final=%s): %r", ev.is_final, ev.transcript)

    @session.on("agent_state_changed")
    def _on_agent_state(ev: AgentStateChangedEvent):
        logger.info("Agent state: %s -> %s", ev.old_state, ev.new_state)

    @session.on("user_state_changed")
    def _on_user_state(ev: UserStateChangedEvent):
        logger.info("User state: %s -> %s", ev.old_state, ev.new_state)

    @session.on("error")
    def _on_error(ev: ErrorEvent):
        logger.error("Session error (source=%s): %s", ev.source, ev.error)

    # Relay everything the agent SAYS to the bridge, so the facilitator's half of
    # the conversation lands in the server-side transcript. The bridge only hears
    # the incoming meeting audio (the humans); the agent's TTS never comes back on
    # that stream, so this data-channel relay is the only way its lines get logged.
    #
    # We keep a strong reference to each relay task: asyncio only holds a WEAK
    # reference to tasks, so a fire-and-forget create_task() can be garbage
    # collected before it runs. This set (plus the done-callback) keeps them alive.
    relay_tasks: set[asyncio.Task] = set()

    @session.on("conversation_item_added")
    def _on_item_added(ev: ConversationItemAddedEvent):
        item = ev.item
        if getattr(item, "role", None) != "assistant":
            return
        text = (getattr(item, "text_content", None) or "").strip()
        if not text:
            return
        payload = json.dumps({"type": "agent_line", "text": text})

        async def _relay() -> None:
            try:
                await ctx.room.local_participant.publish_data(
                    payload, reliable=True, topic=AGENT_TRANSCRIPT_TOPIC
                )
                logger.info("Relayed agent line to bridge transcript: %r", text[:80])
            except Exception:  # noqa: BLE001 - a relay failure must not crash the agent
                logger.exception("Failed to relay agent line to the bridge transcript")

        task = asyncio.create_task(_relay())
        relay_tasks.add(task)
        task.add_done_callback(relay_tasks.discard)

    agent = VoiceAgent(instructions)

    # Learn who is speaking. Meeting BaaS reports the active speaker to the bridge
    # (server.py side); the bridge relays it into this room over a data channel
    # (topic ACTIVE_SPEAKERS_TOPIC). The humans are NOT LiveKit participants —
    # their audio is mixed into the single bridge track — so this relay is the ONLY
    # way the agent can put real names to the voices it hears. The agent then
    # attributes each utterance to its speaker (see on_user_turn_completed).
    @ctx.room.on("data_received")
    def _on_data(packet: rtc.DataPacket):
        # Log every inbound packet so we can confirm bridge<->agent data is flowing.
        logger.info(
            "Data received: topic=%r from=%s (%d bytes)",
            packet.topic,
            getattr(packet.participant, "identity", None),
            len(packet.data),
        )
        if packet.topic != ACTIVE_SPEAKERS_TOPIC:
            return
        try:
            payload = json.loads(bytes(packet.data).decode("utf-8"))
        except (ValueError, TypeError, UnicodeDecodeError):
            return
        if isinstance(payload, dict) and payload.get("type") == "active_speakers":
            agent.set_active_speakers(payload.get("speakers") or [])

    await session.start(
        agent=agent,
        room=ctx.room
    )

    # Wait until the bot is actually admitted into the meeting before speaking,
    # so the greeting isn't lost while the bot sits in the waiting room. server.py
    # sets room metadata {"admitted": true} when Meeting BaaS reports the bot is
    # in the call and recording.
    await wait_until_admitted(ctx)

    # Now greet first, since the bot is in the call and can be heard.
    await session.generate_reply(
        instructions=(
            "Greet the meeting attendees, briefly introduce yourself as the "
            "meeting facilitator, then ask the first agenda item: "
            f"'{agenda[0]}'"
        )
    )

    # Stay in the meeting until it's over, then leave on our own. wait_until_ended
    # returns when server.py signals the call has ended (or the room/bridge
    # drops); we then close the session and shut the job down.
    await wait_until_ended(ctx)
    logger.info("Meeting ended — closing the session and disconnecting.")
    await session.aclose()
    ctx.shutdown(reason="meeting ended")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME))
