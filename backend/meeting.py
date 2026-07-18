"""
Meeting-id flavoured entrypoint for the /meetings frontend.

The launcher frontend (frontend/app/page.tsx) makes the user type a meeting URL,
a room name and an agenda by hand. The /meetings frontend already has a scheduled
meeting record — it deals in a numeric meeting id and knows that meeting's URL,
title and type — so it shouldn't have to invent a LiveKit room name or an agenda
just to put the bot in the call.

This module adds that thinner surface on top of server.py WITHOUT duplicating it:

    POST /api/meetings/{meeting_id}/bot   deploy the bot into a scheduled meeting
    GET  /api/meetings/{meeting_id}/result   transcript + summary, keyed by id

The actual work — creating the Meeting BaaS bot, pointing it at the bridge
websocket, and dispatching agent.py with the agenda as job metadata — is done by
calling server.join_meeting() directly, so there is exactly one implementation of
that flow. Everything else server.py exposes (the /ws/bridge/{room} audio socket,
the Meeting BaaS status webhook, GET /api/meeting/{room}/result) is inherited by
reusing its FastAPI app, which is what makes running this module a superset of
running server.py rather than an alternative to it.

Run it exactly like server.py, from this directory:

    uv run python meeting.py
    # or: uv run uvicorn meeting:app --port 8000
"""

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Reusing server.py's app means this module serves the bridge websocket, the
# Meeting BaaS webhook and the room-keyed result endpoint too — all of which the
# bot flow depends on — plus the CORS config from FRONTEND_URL.
from server import (
    JoinRequest,
    app,
    join_meeting,
    logger,
    meeting_results,
)

# The frontend's meeting type, normalized, mapped to the agenda the agent should
# run when the request carries no explicit agenda. ScheduleMeetingView.tsx builds
# its dropdown from MEETING_TYPES in the task app's src/lib/types.ts, which is the
# authority for these keys:
#
#     MEETING_TYPES = ['Daily Standup', 'Weekly Review', 'Sprint Review', 'Custom']
#
# 'Custom' is deliberately absent: a custom meeting has no inherent shape, so it
# falls through to GENERIC_AGENDA. Lookup is normalization-based and also falls
# back to GENERIC_AGENDA, so a renamed or unknown type degrades to a sensible
# meeting instead of a 400 — but if MEETING_TYPES gains an entry and this map
# doesn't, that type silently runs the generic agenda. Keep them in step.
DEFAULT_AGENDA_BY_TYPE: dict[str, list[str]] = {
    "daily standup": [
        "Welcome everyone and ask each attendee for their progress since yesterday.",
        "Ask each attendee what they are working on today.",
        "Ask if anyone is blocked on anything and who can unblock them.",
        "Summarize the blockers raised and thank everyone before wrapping up.",
    ],
    "weekly review": [
        "Welcome everyone and ask each attendee what they completed this week.",
        "Ask what slipped or did not get finished, and what got in the way.",
        "Ask if anything is blocking progress going into next week.",
        "Ask what each attendee's main focus is for next week.",
        "Summarize the key points and thank everyone before wrapping up.",
    ],
    "sprint review": [
        "Welcome everyone and confirm what this sprint set out to deliver.",
        "Ask the team to walk through what was actually completed this sprint.",
        "Ask what was not finished and what is carrying over to the next sprint.",
        "Ask whether anyone has feedback or concerns about what was delivered.",
        "Summarize the outcomes and thank everyone before wrapping up.",
    ],
}

# Aliases for the names people actually say, normalized to a key above. Kept short
# on purpose: a wrong alias is worse than no alias, because it silently runs the
# wrong agenda instead of the honest generic one.
AGENDA_TYPE_ALIASES: dict[str, str] = {
    "standup": "daily standup",
    "daily scrum": "daily standup",
    "weekly sync": "weekly review",
    "weekly catch up": "weekly review",
    "sprint demo": "sprint review",
    "sprint showcase": "sprint review",
}

# Used when the meeting type is unknown, missing, or has no mapping. Mirrors
# agent.py's DEFAULT_AGENDA so an unmapped type behaves like a bare dispatch.
GENERIC_AGENDA: list[str] = [
    "Welcome everyone and ask each attendee to briefly introduce themselves.",
    "Ask what progress or updates each attendee has since the last meeting.",
    "Ask if there are any blockers or issues the team needs help with.",
    "Ask about the next steps or action items coming out of this discussion.",
    "Summarize the key points raised and thank everyone before wrapping up.",
]

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

# Bot deployments, keyed by the frontend's meeting id.
#
# This has to live server-side: the browser cannot be the source of truth for
# whether a bot is in a call. A page reload wipes any client-side record, but the
# bot is still sitting in the meeting — so the UI would show "Not deployed" over
# a live bot, and a second deploy would put two bots in the same call.
#
# In-memory, like meeting_results and bot_room_map in server.py: a backend
# restart forgets deployments. That is the existing trade-off in this codebase,
# not a new one — the same restart also drops the bridges those bots stream to.
meeting_deployments: dict[int, dict] = {}


def _empty_deployment() -> dict:
    """The 'never deployed' record. Deliberately not a 404 — see get_deployment."""
    return {"deployed": False, "deployedAt": None, "botId": None, "room": None}


def _record_deployment(meeting_id: int, bot_id: str | None, room_name: str) -> dict:
    """
    Remember that a bot is in this meeting, and return the record.

    camelCase because every consumer of it is the TypeScript task app; matching
    its MeetingDeployment shape ({deployed, deployedAt}) means the caller can pass
    this straight back through. botId and room are extra, for tracing.
    """
    record = {
        "deployed": True,
        "deployedAt": datetime.now(timezone.utc).isoformat(),
        "botId": bot_id,
        "room": room_name,
    }
    meeting_deployments[meeting_id] = record
    return record


class CamelModel(BaseModel):
    """
    Speaks the task app's wire format: camelCase in, camelCase out.

    The Task Board backend and its frontend are TypeScript and serialize
    camelCase; the rest of this service is snake_case. Converting at the boundary
    keeps that difference out of the handlers. `populate_by_name` means tests and
    Python callers can still construct these with snake_case field names.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BotContextMeeting(CamelModel):
    """The `meeting` member of MeetingBotContext — only the fields the bot needs."""

    id: int | None = None
    title: str | None = None
    # A MEETING_TYPES value: 'Daily Standup' | 'Weekly Review' | 'Sprint Review' | 'Custom'.
    type: str | None = None
    # The admin-entered join link. Nullable in the task app's own Meeting type, so
    # a meeting can reach us with nothing to join — rejected in deploy_from_context.
    meeting_url: str | None = None


class MeetingBotContextRequest(CamelModel):
    """
    A MeetingBotContext snapshot, as frozen by the task app's
    POST /api/meetings/:meetingId/deploy.

    That endpoint's own docs say it "marks the meeting deployed, freezes a context
    snapshot ... no external bot is called yet" — this service is that external
    bot, and this is the payload it was shaped for.

    Only `meeting` and `narrative` are modelled. The snapshot also carries
    assignedTasks / completedTasks / blockedTasks / overdueTasks / deadlines /
    participants / projects / limitations, but `narrative` is the task app's own
    deterministic flattening of exactly that data and is documented as "meant to
    be fed directly to an LLM" — so re-deriving a brief from the raw task lists
    here would duplicate that logic and let the two drift apart. Pydantic ignores
    the unmodelled fields, so a schemaVersion bump that only adds fields will not
    break this endpoint.
    """

    schema_version: int | None = None
    meeting_id: int | None = None
    generated_at: str | None = None
    meeting: BotContextMeeting = BotContextMeeting()
    narrative: str | None = None


class DeployBotRequest(BaseModel):
    """
    Posted by the /meetings frontend to put the agent into a scheduled meeting.

    meeting_url is required here even though it is Meeting['meetingUrl'] (which is
    nullable in the frontend's type): a meeting scheduled without a link has
    nothing for the bot to join, and failing loudly beats deploying a bot nowhere.
    """

    meeting_url: str
    # One entry per topic/question. Left empty, the meeting type picks the agenda
    # — see resolve_agenda. ScheduleMeetingView.tsx has no agenda field today, so
    # this endpoint is usable before that field exists and improves once it does.
    agenda: list[str] = []
    # Meeting['type'] — the MEETING_TYPES value from the schedule form.
    type: str | None = None
    # Meeting['title'] — used for the agent prompt and the transcript header.
    title: str | None = None
    bot_name: str = "AI Assistant"
    # The generated context narrative, when the frontend has one: a plain-text
    # brief on what each attendee has completed, is overdue on, and has due.
    # Optional — without it the agent runs the agenda knowing nothing about the
    # attendees, which is exactly how it behaved before context existed.
    context: str | None = None


def room_for(meeting_id: int) -> str:
    """
    The LiveKit room name for a scheduled meeting.

    Derived from the id rather than random (as the launcher frontend does) so the
    room is recoverable from the meeting record alone — that's what lets the
    result endpoint below be keyed by id.
    """
    return f"meeting-{meeting_id}"


def _normalize_type(meeting_type: str) -> str:
    """Lowercase and strip punctuation so 'Daily Stand-up' matches 'daily standup'."""
    return re.sub(r"[^a-z0-9]+", " ", meeting_type.lower()).strip()


def default_agenda_for_type(meeting_type: str | None) -> list[str]:
    """The built-in agenda for a meeting type, or GENERIC_AGENDA if unrecognised."""
    if not meeting_type or not meeting_type.strip():
        return GENERIC_AGENDA
    key = _normalize_type(meeting_type)
    key = AGENDA_TYPE_ALIASES.get(key, key)
    return DEFAULT_AGENDA_BY_TYPE.get(key, GENERIC_AGENDA)


def resolve_agenda(agenda: list[str], meeting_type: str | None) -> list[str]:
    """Prefer the frontend's agenda; fall back to the meeting type's default."""
    cleaned = [item.strip() for item in agenda if item and item.strip()]
    if cleaned:
        return cleaned
    fallback = default_agenda_for_type(meeting_type)
    logger.info(
        "No agenda supplied — using the default agenda for type %r (%d items)",
        meeting_type, len(fallback),
    )
    return fallback


@router.post("/{meeting_id}/bot")
async def deploy_bot(meeting_id: int, request: DeployBotRequest):
    """
    Deploy the agent into a scheduled meeting.

    Resolves the id to a room name and the type to an agenda, then hands off to
    server.join_meeting, which creates the Meeting BaaS bot against the bridge
    websocket and dispatches agent.py with the agenda as job metadata. Errors from
    that flow (missing MEETING_BAAS_API_KEY / PUBLIC_BASE_URL, a Meeting BaaS
    rejection, a failed dispatch) surface unchanged.
    """
    meeting_url = request.meeting_url.strip()
    if not meeting_url:
        raise HTTPException(
            status_code=400,
            detail="This meeting has no meeting link — add one before deploying the bot.",
        )

    room_name = room_for(meeting_id)
    agenda = resolve_agenda(request.agenda, request.type)
    context = (request.context or "").strip() or None
    logger.info(
        "Deploying bot for meeting %s (type=%r) into room %s with %d agenda items "
        "and %s context",
        meeting_id, request.type, room_name, len(agenda),
        f"{len(context)} chars of" if context else "no",
    )

    result = await join_meeting(
        JoinRequest(
            meeting_url=meeting_url,
            bot_name=request.bot_name.strip() or "AI Assistant",
            room_name=room_name,
            agenda=agenda,
            meeting_title=request.title,
            context=context,
        )
    )

    # Only recorded once join_meeting returns: it raises on a Meeting BaaS
    # rejection or a failed agent dispatch, so a failure leaves the meeting
    # correctly marked as not deployed rather than lying about a bot that never
    # joined.
    _record_deployment(meeting_id, result.get("bot_id"), room_name)
    return {**result, "meeting_id": meeting_id}


@router.post("/{meeting_id}/deploy")
async def deploy_from_context(meeting_id: int, context: MeetingBotContextRequest) -> dict[str, Any]:
    """
    Deploy the bot straight from a MeetingBotContext snapshot.

    This is the integration point for the task app: its own
    POST /api/meetings/:meetingId/deploy freezes the snapshot and marks the
    meeting deployed, but calls no bot. Forwarding that same snapshot here does
    the actual work — everything needed is already inside it:

        meeting.meetingUrl -> the call to join
        meeting.type       -> which default agenda to run
        meeting.title      -> the agent prompt and transcript header
        narrative          -> the agent's background brief

    The response mirrors the task app's own MeetingDeployment shape
    ({deployed, deployedAt}) so the caller can pass it back through, with botId
    and room added for tracing.

    Prefer this over POST /{meeting_id}/bot when a context package exists — that
    endpoint takes the same information as loose fields and is what the standalone
    launcher uses.
    """
    meeting_url = (context.meeting.meeting_url or "").strip()
    if not meeting_url:
        raise HTTPException(
            status_code=400,
            detail="This meeting has no meeting link — add one before deploying the bot.",
        )

    # The path is authoritative: the body's meetingId is whatever the snapshot was
    # built with, and a mismatch means the caller is deploying the wrong snapshot.
    if context.meeting_id is not None and context.meeting_id != meeting_id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Context is for meeting {context.meeting_id}, but was posted to "
                f"meeting {meeting_id}."
            ),
        )

    room_name = room_for(meeting_id)
    agenda = default_agenda_for_type(context.meeting.type)
    narrative = (context.narrative or "").strip() or None
    logger.info(
        "Deploying bot for meeting %s from context snapshot (type=%r, schema=%s) "
        "into room %s with %d agenda items and %s narrative",
        meeting_id, context.meeting.type, context.schema_version, room_name,
        len(agenda), f"{len(narrative)} chars of" if narrative else "no",
    )

    result = await join_meeting(
        JoinRequest(
            meeting_url=meeting_url,
            bot_name="AI Assistant",
            room_name=room_name,
            agenda=agenda,
            meeting_title=context.meeting.title,
            context=narrative,
        )
    )

    record = _record_deployment(meeting_id, result.get("bot_id"), room_name)
    return {**record, "agendaItems": len(agenda)}


@router.get("/{meeting_id}/deploy")
async def get_deployment(meeting_id: int) -> dict[str, Any]:
    """
    Whether a bot has been deployed into this meeting, and when.

    Mirrors the task app's own GET /api/meetings/:meetingId/deploy, so the two
    agree on both the path and the MeetingDeployment shape.

    Never 404s. "Never deployed" is an ordinary state for every meeting that
    exists, not a missing resource — the UI renders it as a plain "Not deployed"
    badge, and making it an error would force every caller to treat the normal
    case as a failure.
    """
    return meeting_deployments.get(meeting_id, _empty_deployment())


@router.get("/{meeting_id}/result")
async def get_result(meeting_id: int):
    """
    Transcript + summary for a scheduled meeting, keyed by meeting id.

    Same payload as server.py's GET /api/meeting/{room}/result — {"ended": false}
    until the meeting finishes — but callers poll with the id they already have
    instead of having to know how room names are built.
    """
    room_name = room_for(meeting_id)
    return meeting_results.get(room_name, {"ended": False})


# Mount onto server.py's app so this module serves the meetings endpoints AND
# everything the bot flow needs from server.py (bridge websocket + webhook).
app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
