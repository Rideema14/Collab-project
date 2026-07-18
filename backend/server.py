import json
import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from pydantic import BaseModel

from bridge import MeetingLiveKitBridge, SAMPLE_RATE

load_dotenv()

logger = logging.getLogger("meeting-baas-server")
logging.basicConfig(level=logging.INFO)

# Must match AGENT_NAME in agent.py so the explicit dispatch reaches our worker.
AGENT_NAME = "meeting-agent"

app = FastAPI(title="Meeting BaaS to LiveKit App")

# Browser origins allowed to call this API. Comma-separated, because the launcher
# frontend and the /meetings app run on different ports and both talk to this
# server (see meeting.py, which serves its routes from this same app).
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# One bridge per LiveKit room, owning that room's single Meeting BaaS socket.
bridges: dict[str, MeetingLiveKitBridge] = {}

# Maps Meeting BaaS bot_id -> LiveKit room_name, so the status webhook can find
# which room to signal when the bot is admitted into the call.
bot_room_map: dict[str, str] = {}

# Finished meeting results keyed by LiveKit room_name. The bridge transcribes the
# meeting; when it ends we generate the summary and store it here, and the
# frontend polls GET /api/meeting/{room}/result to show the popup.
meeting_results: dict[str, dict] = {}

# Meeting title per room (from the join request), used for the transcript header.
room_titles: dict[str, str] = {}


def get_or_create_bridge(room_name: str) -> MeetingLiveKitBridge:
    if room_name not in bridges:
        bridges[room_name] = MeetingLiveKitBridge(
            room_name, meeting_title=room_titles.get(room_name)
        )
    return bridges[room_name]


class JoinRequest(BaseModel):
    meeting_url: str
    bot_name: str = "AI Assistant"
    room_name: str = "livekit-meeting-room"
    # Agenda items the agent must stick to. One entry per topic/question.
    agenda: list[str] = []
    meeting_title: str | None = None
    # Optional background brief (what attendees have been working on) passed
    # through to the agent as job metadata. Informs its questions; does NOT widen
    # what it is allowed to discuss — the agenda still bounds that.
    context: str | None = None


class TranscriptResult(BaseModel):
    """Posted by the agent (agent.py) when a meeting ends."""
    room_name: str
    transcript: str = ""


async def dispatch_agent(
    room_name: str,
    agenda: list[str],
    meeting_title: str | None,
    context: str | None = None,
) -> None:
    """
    Dispatch our LiveKit agent (agent.py) into `room_name`, passing the meeting
    agenda as job metadata. agent.py reads this via ctx.job.metadata and restricts
    the conversation to these items.

    `context` is an optional background brief the agent uses to ask informed
    questions. It rides along in the same metadata blob.
    """
    metadata = json.dumps(
        {"agenda": agenda, "meeting_title": meeting_title, "context": context}
    )
    lkapi = api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    try:
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=AGENT_NAME,
                room=room_name,
                metadata=metadata,
            )
        )
        logger.info("Dispatched agent '%s' to room %s (%d agenda items)", AGENT_NAME, room_name, len(agenda))
    finally:
        await lkapi.aclose()


async def signal_admitted(room_name: str) -> None:
    """
    Tell the agent that the bot is now admitted into the meeting by setting the
    room metadata to {"admitted": true}. agent.py waits for this before speaking
    so its greeting isn't lost while the bot is still in the waiting room.
    """
    lkapi = api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    try:
        await lkapi.room.update_room_metadata(
            api.UpdateRoomMetadataRequest(
                room=room_name,
                metadata=json.dumps({"admitted": True}),
            )
        )
        logger.info("Signalled admission to room %s", room_name)
    finally:
        await lkapi.aclose()


async def signal_ended(room_name: str) -> None:
    """
    Tell the agent the meeting is over by setting room metadata {"ended": true}.
    agent.py waits on this (wait_until_ended) and then disconnects on its own,
    finalizing and posting the transcript. We keep "admitted" set too so nothing
    downstream mistakes the transition for the bot being ejected mid-call.
    """
    lkapi = api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    try:
        await lkapi.room.update_room_metadata(
            api.UpdateRoomMetadataRequest(
                room=room_name,
                metadata=json.dumps({"admitted": True, "ended": True}),
            )
        )
        logger.info("Signalled meeting end to room %s", room_name)
    finally:
        await lkapi.aclose()


async def summarize_transcript(transcript_text: str) -> str:
    """
    Produce a concise, structured summary of the meeting transcript using Groq
    (same provider agent.py uses for the LLM). Best-effort: returns "" if the key
    is missing, the transcript is empty, or the call fails, so the frontend can
    still show the raw transcript.
    """
    api_key = os.getenv("GROQ_API_KEY")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    if not api_key or not transcript_text.strip():
        return ""

    instructions = (
        "Summarize the following meeting transcript for someone who missed it. "
        "Use short markdown sections with these headings: '## Overview' (2-3 "
        "sentences), '## Key Points' (bullets), '## Decisions' (bullets, or "
        "'None') and '## Action Items' (bullets naming the owner when stated, or "
        "'None'). Be concise and only use what the transcript actually says."
    )
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.3,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You write clear, structured meeting summaries.",
                        },
                        {
                            "role": "user",
                            "content": f"{instructions}\n\nTRANSCRIPT:\n{transcript_text}",
                        },
                    ],
                },
            )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:  # noqa: BLE001 - a summary failure must not lose the transcript
        logger.exception("Failed to summarize transcript")
        return ""


@app.post("/api/bot/join")
async def join_meeting(request: JoinRequest):
    """
    Creates a Meeting BaaS bot that streams meeting audio to/from this server's
    websocket endpoints, which are in turn bridged into a LiveKit room.
    """
    baas_api_key = os.getenv("MEETING_BAAS_API_KEY")
    if not baas_api_key:
        raise HTTPException(status_code=500, detail="MEETING_BAAS_API_KEY is not set in .env")

    public_base_url = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    if not public_base_url:
        raise HTTPException(
            status_code=500,
            detail="PUBLIC_BASE_URL is not set in .env (e.g. your ngrok https URL, so "
            "Meeting BaaS can reach this server's websocket endpoints)",
        )
    ws_base = public_base_url.replace("https://", "wss://").replace("http://", "ws://")

    # Meeting BaaS opens exactly one websocket connection and uses it for both
    # directions, so input_url and output_url must point at the same URL.
    #
    # v2 matches Meeting BaaS's own first-party bot implementation
    # (github.com/Meeting-Baas/speaking-meeting-bot, scripts/meetingbaas_api.py).
    # audio_frequency is an integer Hz value here (unlike v1's "16khz" string).
    bridge_ws_url = f"{ws_base}/ws/bridge/{request.room_name}"
    payload = {
        "meeting_url": request.meeting_url,
        "bot_name": request.bot_name,
        "streaming_enabled": True,
        "streaming_config": {
            "input_url": bridge_ws_url,
            "output_url": bridge_ws_url,
            "audio_frequency": SAMPLE_RATE,
        },
        "recording_mode": "audio_only",
        "allow_multiple_bots": True,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.meetingbaas.com/v2/bots",
            headers={
                "x-meeting-baas-api-key": baas_api_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    bot_id = data.get("data", {}).get("bot_id")

    # Remember which room this bot belongs to, so the status webhook can signal
    # admission to the right room. Also remember the meeting title for the
    # transcript header the bridge writes.
    if bot_id:
        bot_room_map[bot_id] = request.room_name
    if request.meeting_title:
        room_titles[request.room_name] = request.meeting_title

    # Dispatch our agenda-driven agent into the same LiveKit room the bridge uses.
    agenda = [item.strip() for item in request.agenda if item and item.strip()]
    try:
        await dispatch_agent(request.room_name, agenda, request.meeting_title, request.context)
    except Exception as exc:  # noqa: BLE001 - surface the reason to the caller
        logger.exception("Agent dispatch failed for room %s", request.room_name)
        raise HTTPException(
            status_code=502,
            detail=f"Bot deployed (bot_id={bot_id}) but agent dispatch failed: {exc}",
        )

    return {
        "status": "success",
        "message": f"Bot deployed to {request.meeting_url}",
        "bot_id": bot_id,
        "livekit_room": request.room_name,
        "agenda_items": len(agenda),
    }


@app.post("/")
async def meeting_baas_webhook(request: Request):
    """
    Meeting BaaS POSTs bot lifecycle events to our base URL. We use the
    'in_call_recording' status (bot admitted + recording) to tell the agent it
    can start speaking. Terminal statuses clean up the bot_id -> room mapping.
    """
    raw = await request.body()
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        payload = None

    if not isinstance(payload, dict) or payload.get("event") != "bot.status_change":
        logger.info("Meeting BaaS root POST (non-status): %r", raw[:300])
        return {"ok": True}

    data = payload.get("data") or {}
    bot_id = data.get("bot_id")
    code = (data.get("status") or {}).get("code")
    logger.info("Meeting BaaS status: bot=%s code=%s", bot_id, code)

    if code == "in_call_recording" and bot_id in bot_room_map:
        room_name = bot_room_map[bot_id]
        try:
            await signal_admitted(room_name)
        except Exception:  # noqa: BLE001 - never let a webhook error 500
            logger.exception("Failed to signal admission for room %s", room_name)
    elif code in ("call_ended", "recording_succeeded") or payload.get("event") == "complete":
        # Meeting is over: tell the agent to leave, then forget the bot mapping.
        room_name = bot_room_map.get(bot_id)
        if room_name:
            try:
                await signal_ended(room_name)
            except Exception:  # noqa: BLE001 - never let a webhook error 500
                logger.exception("Failed to signal meeting end for room %s", room_name)
        bot_room_map.pop(bot_id, None)

    return {"ok": True}


@app.post("/api/meeting/result")
async def submit_meeting_result(result: TranscriptResult):
    """
    Receive the finished transcript from the agent, summarize it, and store it so
    the frontend can display it. Called by agent.py's shutdown handler.
    """
    summary = await summarize_transcript(result.transcript)
    meeting_results[result.room_name] = {
        "ended": True,
        "transcript": result.transcript,
        "summary": summary,
    }
    logger.info(
        "Stored meeting result for room %s (transcript %d chars, summary %d chars)",
        result.room_name, len(result.transcript), len(summary),
    )
    return {"ok": True}


@app.get("/api/meeting/{room_name}/result")
async def get_meeting_result(room_name: str):
    """
    Polled by the frontend after launch. Returns {"ended": false} until the agent
    posts the transcript, then the full result so the popup can be shown.
    """
    return meeting_results.get(room_name, {"ended": False})


@app.websocket("/ws/bridge/{room_name}")
async def bridge_socket(websocket: WebSocket, room_name: str):
    """Meeting BaaS's single bidirectional audio connection for this room."""
    await websocket.accept()
    logger.info("Meeting BaaS connected (room=%s)", room_name)
    bridge = get_or_create_bridge(room_name)
    try:
        await bridge.run(websocket)
    finally:
        # The Meeting BaaS socket closed => the bot has been disconnected from the
        # meeting. Tell the agent to leave (it also sees the bridge participant
        # drop when we disconnect the bridge from LiveKit below), then finalize
        # the transcript, summarize it, and store the result for the frontend.
        logger.info("Meeting BaaS socket closed (room=%s) — ending meeting.", room_name)
        try:
            await signal_ended(room_name)
        except Exception:  # noqa: BLE001 - cleanup must not raise out of the socket handler
            logger.exception("Failed to signal end on socket close for room %s", room_name)

        transcript_path = bridge.transcript.path if bridge.transcript else None
        try:
            await bridge.aclose()  # flushes + closes the transcript file
        except Exception:  # noqa: BLE001
            logger.exception("Failed to close bridge for room %s", room_name)
        bridges.pop(room_name, None)

        await store_meeting_result(room_name, transcript_path)


async def store_meeting_result(room_name: str, transcript_path) -> None:
    """Read the finished transcript, summarize it, and store it for the frontend."""
    transcript_text = ""
    if transcript_path is not None:
        try:
            transcript_text = Path(transcript_path).read_text(encoding="utf-8")
        except OSError:
            logger.exception("Could not read transcript file %s", transcript_path)

    summary = await summarize_transcript(transcript_text)
    meeting_results[room_name] = {
        "ended": True,
        "transcript": transcript_text,
        "summary": summary,
    }
    logger.info(
        "Stored meeting result for room %s (transcript %d chars, summary %d chars)",
        room_name, len(transcript_text), len(summary),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
