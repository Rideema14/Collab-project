"""
Bridges audio between a Meeting BaaS bot and a LiveKit room.

Meeting BaaS does not support dialing directly into a LiveKit SIP endpoint.
Instead, when creating a bot you give it a "streaming" config (see server.py).
Verified against Meeting BaaS's own reference implementation
(github.com/Meeting-Baas/speaking-meeting-bot, scripts/meetingbaas_api.py +
app/websockets.py):

  - "input" and "output" must be the SAME url. Meeting BaaS opens exactly one
    websocket connection to it and uses it bidirectionally.
  - The connection opens with a JSON handshake/text frame, e.g.
    {"protocol_version": 1, "bot_id": "...", "offset": 0, "sample_rate": 16000}.
  - Audio frames are expected as raw binary 16-bit PCM mono websocket messages.
    Meeting BaaS's exact live wire format beyond the handshake isn't publicly
    documented, so _receive_loop below also defensively handles the
    possibility of audio arriving as JSON text frames with a base64-encoded
    "chunk"/"payload"/"audio"/"data" field, and logs anything it doesn't
    recognize so the real format can be nailed down from live traffic.
"""

import asyncio
import base64
import json
import logging
import os

import aiohttp
from livekit import rtc, api
from livekit.agents import stt as stt_mod
from livekit.plugins import deepgram

from transcript import TranscriptLogger

logger = logging.getLogger("meeting-bridge")

SAMPLE_RATE = 16000
NUM_CHANNELS = 1

# LiveKit data-channel topic the bridge uses to relay Meeting BaaS's active-speaker
# frames to the agent (which runs in a separate process). The meeting participants
# are NOT LiveKit participants — their audio is mixed into our single bridge track —
# so LiveKit's own speaker events can't name them; this relay is how agent.py learns
# real speaker names. Keep this string in sync with agent.py.
ACTIVE_SPEAKERS_TOPIC = "active_speakers"

# LiveKit data-channel topic the agent uses to send its OWN spoken lines here. The
# bridge transcribes only the incoming meeting audio (the humans); the agent's TTS
# isn't in that stream, so the agent relays each line it says and the bridge logs it
# into the transcript via log_agent(). Keep this string in sync with agent.py.
AGENT_TRANSCRIPT_TOPIC = "agent_transcript"


def extract_active_speakers(payload: dict) -> list[str]:
    """
    Pull the currently-speaking participant name(s) out of a Meeting BaaS live
    control frame.

    The confirmed real format (observed from live traffic) is a top-level JSON
    array of participant states:
        [{"name": "Alice", "id": 2, "timestamp": 1784..., "isSpeaking": true},
         {"name": "AI Assistant", "id": 1, "isSpeaking": false}]
    We return the names whose isSpeaking is truthy. A few other dict shapes are
    still matched defensively; an empty list means nobody is currently speaking.
    """

    def _name(value: object) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            for key in ("name", "displayName", "display_name", "participant", "speaker"):
                got = value.get(key)
                if isinstance(got, str) and got.strip():
                    return got.strip()
        return None

    def _speaking_names(items: list) -> list[str]:
        out = []
        for p in items:
            if isinstance(p, dict) and (
                p.get("isSpeaking") or p.get("is_speaking") or p.get("speaking")
            ):
                n = _name(p)
                if n:
                    out.append(n)
        return out

    # Confirmed shape: a bare top-level list of participant speaking-states.
    if isinstance(payload, list):
        return _speaking_names(payload)

    if not isinstance(payload, dict):
        return []

    # Shape 1: {"speakers": ["Alice", ...]} or [{"name": "Alice", ...}, ...]
    speakers = payload.get("speakers")
    if isinstance(speakers, list):
        names = [n for n in (_name(s) for s in speakers) if n]
        if names:
            return names

    # Shape 2: {"participants": [{"name": "Alice", "isSpeaking": true}, ...]}
    participants = payload.get("participants")
    if isinstance(participants, list):
        names = []
        for p in participants:
            if isinstance(p, dict) and (
                p.get("isSpeaking") or p.get("is_speaking") or p.get("speaking")
            ):
                n = _name(p)
                if n:
                    names.append(n)
        if names:
            return names

    # Shape 3: a single active-speaker object under a few likely keys.
    for key in ("active_speaker", "activeSpeaker", "speaker"):
        n = _name(payload.get(key))
        if n:
            return [n]

    # Shape 4: a flat single-participant speaking-state frame.
    if payload.get("isSpeaking") or payload.get("is_speaking") or payload.get("speaking"):
        n = _name(payload)
        if n:
            return [n]

    return []


class MeetingLiveKitBridge:
    """Owns one LiveKit room connection bridged to a single Meeting BaaS websocket."""

    def __init__(self, room_name: str, meeting_title: str | None = None):
        self.room_name = room_name
        self.meeting_title = meeting_title
        self.room = rtc.Room()
        self._audio_source: rtc.AudioSource | None = None
        self._connect_lock = asyncio.Lock()
        self._connected = False
        # Last active-speaker set we saw, so we only act on changes.
        self._last_speakers: list[str] = []

        # Server-side transcription of the meeting audio. The bridge is the one
        # place that has BOTH the raw meeting audio and the real participant
        # names (from Meeting BaaS speaker frames), so the transcript is taken
        # here — completely separate from the answering agent (agent.py).
        self.transcript: TranscriptLogger | None = None
        self._stt: deepgram.STT | None = None
        self._stt_stream = None
        self._stt_task: asyncio.Task | None = None
        # Our own HTTP session for the Deepgram plugin. Required because the
        # bridge runs inside server.py (FastAPI), not the LiveKit agent worker,
        # so the plugin's shared session isn't available here.
        self._http: aiohttp.ClientSession | None = None

    async def _ensure_connected(self):
        async with self._connect_lock:
            if self._connected:
                return
            token = (
                api.AccessToken(os.getenv("LIVEKIT_API_KEY"), os.getenv("LIVEKIT_API_SECRET"))
                .with_identity(f"meeting-bridge-{self.room_name}")
                .with_grants(api.VideoGrants(room_join=True, room=self.room_name))
                .to_jwt()
            )
            await self.room.connect(os.getenv("LIVEKIT_URL"), token)
            logger.info("Bridge connected to LiveKit room %s", self.room_name)

            self._audio_source = rtc.AudioSource(SAMPLE_RATE, NUM_CHANNELS)
            track = rtc.LocalAudioTrack.create_audio_track("meeting-audio", self._audio_source)
            await self.room.local_participant.publish_track(
                track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
            )

            # Start transcribing the incoming meeting audio.
            self.transcript = TranscriptLogger(
                room_name=self.room_name, meeting_title=self.meeting_title
            )
            self._http = aiohttp.ClientSession()
            self._stt = deepgram.STT(
                model="nova-3",
                language="en-US",
                sample_rate=SAMPLE_RATE,
                http_session=self._http,
            )
            self._stt_stream = self._stt.stream()
            self._stt_task = asyncio.create_task(self._transcribe_loop())
            logger.info("Bridge transcription started -> %s", self.transcript.path)

            # Log the agent's own spoken lines, which it relays here over the data
            # channel (its TTS never comes back on the meeting audio, so the STT
            # loop above can't capture it). This gives a complete transcript with
            # both the humans and the facilitator.
            @self.room.on("data_received")
            def _on_data(packet: rtc.DataPacket) -> None:
                logger.info(
                    "Room %s: data received topic=%r from=%s (%d bytes)",
                    self.room_name, packet.topic,
                    getattr(packet.participant, "identity", None), len(packet.data),
                )
                if packet.topic != AGENT_TRANSCRIPT_TOPIC or self.transcript is None:
                    return
                try:
                    payload = json.loads(bytes(packet.data).decode("utf-8"))
                except (ValueError, TypeError, UnicodeDecodeError):
                    return
                if isinstance(payload, dict) and payload.get("type") == "agent_line":
                    text = (payload.get("text") or "").strip()
                    if text:
                        self.transcript.log_agent(text)
                        logger.info(
                            "Room %s: logged agent line from relay: %r",
                            self.room_name, text[:80],
                        )

            self._connected = True

    async def _transcribe_loop(self) -> None:
        """Read Deepgram results and log each finalized utterance under the
        participant Meeting BaaS currently reports as speaking."""
        try:
            async for ev in self._stt_stream:
                if ev.type == stt_mod.SpeechEventType.FINAL_TRANSCRIPT and ev.alternatives:
                    text = (ev.alternatives[0].text or "").strip()
                    if text and self.transcript is not None:
                        self.transcript.log_user(text)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - a transcription error must not kill the bridge
            logger.exception("Room %s: transcription loop error", self.room_name)

    async def run(self, websocket) -> None:
        """Owns the single Meeting BaaS websocket connection for this room for its
        whole lifetime, pumping audio in both directions concurrently."""
        await self._ensure_connected()

        receive_task = asyncio.create_task(self._receive_loop(websocket))
        send_task = asyncio.create_task(self._send_loop(websocket))
        try:
            await asyncio.wait({receive_task, send_task}, return_when=asyncio.FIRST_COMPLETED)
        finally:
            receive_task.cancel()
            send_task.cancel()
            for task in (receive_task, send_task):
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

    async def _receive_loop(self, websocket) -> None:
        """Consumes meeting audio (binary frames) from Meeting BaaS and feeds it into
        the LiveKit room so the agent (agent.py) can hear it. Ignores JSON text frames
        (participant speaking-state)."""
        frame_count = 0
        text_frame_count = 0
        unrecognized_count = 0
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                logger.info(
                    "Meeting BaaS socket disconnected for room %s (code=%s)",
                    self.room_name, message.get("code"),
                )
                return

            data = message.get("bytes")
            if not data:
                # Not a raw binary frame - could be a control message (e.g. the
                # protocol handshake / speaking-state) or audio wrapped in JSON.
                # We don't have confirmed docs for this, so parse defensively
                # and log anything we don't recognize instead of dropping it
                # silently.
                text_frame_count += 1
                text = message.get("text") or ""
                try:
                    payload = json.loads(text)
                except (ValueError, TypeError):
                    payload = None

                pcm_bytes = None
                if isinstance(payload, dict):
                    for key in ("chunk", "payload", "audio", "data"):
                        value = payload.get(key)
                        if isinstance(value, str) and value:
                            try:
                                pcm_bytes = base64.b64decode(value)
                            except (ValueError, TypeError):
                                pcm_bytes = None
                            break

                if pcm_bytes:
                    data = pcm_bytes
                else:
                    # Not audio. See if it's a speaker/participant frame telling
                    # us who is talking; if so, note it for transcript labelling.
                    # Meeting BaaS sends these as a top-level JSON array, so pass
                    # the payload through whether it's a list or a dict.
                    speakers = extract_active_speakers(payload)
                    if speakers:
                        await self._note_active_speaker(speakers)
                        continue

                    if text_frame_count <= 5:
                        logger.info(
                            "Room %s: non-audio text frame #%d from Meeting BaaS: %r",
                            self.room_name, text_frame_count, text[:300],
                        )
                    else:
                        unrecognized_count += 1
                        if unrecognized_count % 50 == 0:
                            logger.info(
                                "Room %s: %d more non-audio text frames received (keys=%s)",
                                self.room_name, unrecognized_count,
                                list(payload.keys()) if isinstance(payload, dict) else None,
                            )
                    continue

            frame_count += 1
            if frame_count == 1:
                logger.info("Room %s: first meeting audio frame received (%d bytes)", self.room_name, len(data))
            elif frame_count % 200 == 0:
                logger.info("Room %s: %d meeting audio frames received so far", self.room_name, frame_count)

            frame = rtc.AudioFrame(
                data=data,
                sample_rate=SAMPLE_RATE,
                num_channels=NUM_CHANNELS,
                samples_per_channel=len(data) // 2,
            )
            # Into the room (so the agent can hear it) and into the transcriber.
            await self._audio_source.capture_frame(frame)
            if self._stt_stream is not None:
                self._stt_stream.push_frame(frame)

    async def _note_active_speaker(self, names: list[str]) -> None:
        """
        Record who Meeting BaaS currently reports as speaking, and relay it to the
        LiveKit room so the agent (a separate process) also learns who's talking.
        De-duplicated so we only act when the active-speaker set actually changes.
        """
        if names == self._last_speakers:
            return
        self._last_speakers = names

        # 1. Label the server-side transcript (bridge-local).
        if names and self.transcript is not None:
            self.transcript.set_active_speaker(names[0])
            logger.info("Room %s: active speaker -> %s", self.room_name, names[0])

        # 2. Relay to the agent over a LiveKit data channel. The humans aren't
        #    LiveKit participants, so this is the only way agent.py can put a real
        #    name to the mixed audio it hears. Broadcast (no destination) + reliable.
        if self._connected:
            payload = json.dumps({"type": "active_speakers", "speakers": names})
            try:
                await self.room.local_participant.publish_data(
                    payload, reliable=True, topic=ACTIVE_SPEAKERS_TOPIC
                )
            except Exception:  # noqa: BLE001 - a relay failure must not kill the bridge
                logger.exception(
                    "Room %s: failed to relay active speakers", self.room_name
                )

    async def _send_loop(self, websocket) -> None:
        """Forwards the LiveKit agent's spoken (TTS) audio to Meeting BaaS as raw
        binary frames so the bot speaks it into the meeting."""
        track_queue: asyncio.Queue = asyncio.Queue()

        for participant in self.room.remote_participants.values():
            for publication in participant.track_publications.values():
                if publication.track is not None and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
                    track_queue.put_nowait(publication.track)

        @self.room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                track_queue.put_nowait(track)

        track = await track_queue.get()
        audio_stream = rtc.AudioStream(track, sample_rate=SAMPLE_RATE, num_channels=NUM_CHANNELS)
        async for event in audio_stream:
            await websocket.send_bytes(event.frame.data.tobytes())

    async def aclose(self) -> None:
        # Finalize transcription: flush Deepgram, stop the reader, close the file.
        if self._stt_stream is not None:
            try:
                await self._stt_stream.aclose()
            except Exception:  # noqa: BLE001
                logger.exception("Room %s: error closing STT stream", self.room_name)
        if self._stt_task is not None:
            try:
                await asyncio.wait_for(self._stt_task, timeout=5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._stt_task.cancel()
            except Exception:  # noqa: BLE001
                logger.exception("Room %s: transcription task error on close", self.room_name)
            self._stt_task = None
        if self.transcript is not None:
            self.transcript.close()
        if self._http is not None:
            try:
                await self._http.close()
            except Exception:  # noqa: BLE001
                logger.exception("Room %s: error closing HTTP session", self.room_name)
            self._http = None

        if self._connected:
            await self.room.disconnect()
            self._connected = False
