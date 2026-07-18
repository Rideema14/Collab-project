"""
transcript.py — Speaker-labelled meeting transcript logging.

Captures *who said what* during a live meeting and writes it to a plain-text
file for later review.

How speaker identification works here
-------------------------------------
The Meeting BaaS bridge (see bridge.py) mixes every participant into a single
mono audio track before it reaches the agent, so there are no per-person LiveKit
tracks to tell voices apart. Instead we rely on **Deepgram diarization**
(`diarize=True` on the STT in agent.py): Deepgram clusters the mixed audio by
voice and tags each finalized transcript with a `speaker_id`. That id is
anonymous and per-session (0, 1, 2, ...), so we present it as "Speaker 1",
"Speaker 2", etc. If you later obtain the real display names (e.g. from Meeting
BaaS speaker events), call `rename_speaker()` to relabel them in the file.

What gets logged
----------------
- Each participant's finalized speech, prefixed with its diarized speaker label.
- Every line the agent speaks (its committed assistant messages).
- A timestamp on every line, plus a header/footer with meeting metadata.

Usage (from agent.py)
---------------------
    from transcript import TranscriptLogger

    transcript = TranscriptLogger(room_name=ctx.room.name, meeting_title=title)
    transcript.attach(session)                 # wire up session events
    ctx.add_shutdown_callback(transcript.aclose)
"""

from __future__ import annotations

import logging
import os
import re
import threading
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("transcript")

# Where transcript files are written. Override with the TRANSCRIPT_DIR env var.
DEFAULT_TRANSCRIPT_DIR = Path(os.getenv("TRANSCRIPT_DIR", "transcripts"))

# Label used when a line has no diarization info (speaker_id is None) — e.g. if
# diarization is disabled or Deepgram couldn't attribute the audio.
UNKNOWN_SPEAKER_LABEL = "Participant"

# Label shown for the agent's own spoken lines.
AGENT_LABEL = "Agent"


def _slugify(value: str) -> str:
    """Make a string safe to use inside a filename."""
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    return slug.strip("-") or "meeting"


class TranscriptLogger:
    """
    Writes a running, speaker-labelled transcript of one meeting to a text file.

    Thread-safe: all writes go through a lock and each line is flushed to disk,
    so the file stays readable live while the meeting is in progress.
    """

    def __init__(
        self,
        room_name: str,
        meeting_title: str | None = None,
        directory: str | os.PathLike | None = None,
    ) -> None:
        self.room_name = room_name
        self.meeting_title = meeting_title
        self._lock = threading.Lock()
        self._closed = False

        # Real display names per diarization speaker_id — learned live from
        # Meeting BaaS active-speaker events, or set explicitly via
        # rename_speaker(). The first real name learned for a voice wins, so a
        # momentarily-stale live signal can't relabel an already-named voice.
        self._names: dict[str, str] = {}
        # Anonymous "Speaker 1", "Speaker 2", ... fallback labels per speaker_id,
        # for voices we never learned a real name for. Assigned in first-heard
        # order.
        self._anon: dict[str, str] = {}
        self._next_speaker_no = 1

        # The participant Meeting BaaS most recently reported as speaking, pushed
        # in over the LiveKit data channel by the bridge (see attach_room). Used
        # to label lines with the real name; None when unknown. Read/written only
        # on the asyncio event-loop thread, so no lock is needed for it.
        self._active_speaker: str | None = None

        self._started_at = datetime.now()

        # Build a unique, human-scannable filename per meeting session.
        out_dir = Path(directory) if directory else DEFAULT_TRANSCRIPT_DIR
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = self._started_at.strftime("%Y%m%d_%H%M%S")
        self.path = out_dir / f"{_slugify(room_name)}_{stamp}.txt"

        # Line-buffered append handle; header written immediately.
        self._fh = open(self.path, "a", encoding="utf-8", buffering=1)
        self._write_header()
        logger.info("Transcript file opened: %s", self.path)

    # -- public API ---------------------------------------------------------

    def attach(self, session) -> None:
        """
        Subscribe to an AgentSession so speech is logged automatically.

        - User speech comes from `user_input_transcribed` (final only), which
          carries the diarized `speaker_id`.
        - Agent speech comes from `conversation_item_added` filtered to the
          assistant role (the user role is already covered above, so we skip it
          to avoid double-logging).
        """

        @session.on("user_input_transcribed")
        def _on_user_transcript(ev) -> None:  # UserInputTranscribedEvent
            if not getattr(ev, "is_final", False):
                return
            text = (ev.transcript or "").strip()
            if text:
                self.log_user(text, speaker_id=getattr(ev, "speaker_id", None))

        @session.on("conversation_item_added")
        def _on_item_added(ev) -> None:  # ConversationItemAddedEvent
            item = getattr(ev, "item", None)
            if item is None or getattr(item, "role", None) != "assistant":
                return
            text = (item.text_content or "").strip()
            if text:
                self.log_agent(text)

    def set_active_speaker(self, name: str | None) -> None:
        """Record who Meeting BaaS currently reports as speaking (or None)."""
        name = name.strip() if isinstance(name, str) else None
        if name != self._active_speaker:
            self._active_speaker = name
            if name:
                logger.debug("Active speaker is now %r", name)

    def log_user(self, text: str, speaker_id: object = None, when: datetime | None = None) -> None:
        """
        Record one finalized participant utterance under its speaker label.

        Identity is keyed on the diarization speaker_id and named from the live
        Meeting BaaS active speaker:
          - The first real name seen for a voice is remembered and reused for all
            of that voice's later lines (a stale live signal can't relabel it).
          - A voice with no real name yet, but a live name now, takes that name.
          - Otherwise it falls back to an anonymous "Speaker N" label, or
            "Participant" when there's no diarization info at all.
        """
        name = self._active_speaker
        key = self._key(speaker_id)

        if key != "?":
            with self._lock:
                if name and key not in self._names:
                    self._names[key] = name  # learn first real name for this voice
                label = self._names.get(key)
            label = label or name or self._anon_label(key)
        else:
            label = name or UNKNOWN_SPEAKER_LABEL

        self._write_line(label, text, when)

    def log_agent(self, text: str, when: datetime | None = None) -> None:
        """Record one line spoken by the agent."""
        self._write_line(AGENT_LABEL, text, when)

    def rename_speaker(self, speaker_id: object, name: str) -> None:
        """
        Map a raw diarization speaker_id to a real display name.

        Call this if you learn the actual participant name (e.g. from Meeting
        BaaS speaker events). Applies to all lines written afterwards; earlier
        lines keep the anonymous label they were written with.
        """
        key = self._key(speaker_id)
        with self._lock:
            self._names[key] = name

    def close(self) -> None:
        """Write the footer and close the file. Safe to call more than once."""
        with self._lock:
            if self._closed:
                return
            self._closed = True
            try:
                ended = datetime.now()
                duration = ended - self._started_at
                self._fh.write(
                    f"\n{'=' * 60}\n"
                    f"Ended:    {ended:%Y-%m-%d %H:%M:%S}\n"
                    f"Duration: {self._format_duration(duration.total_seconds())}\n"
                    f"{'=' * 60}\n"
                )
                self._fh.flush()
            finally:
                self._fh.close()
                logger.info("Transcript file closed: %s", self.path)

    async def aclose(self) -> None:
        """Async wrapper so this can be passed to ctx.add_shutdown_callback."""
        self.close()

    # -- internals ----------------------------------------------------------

    @staticmethod
    def _key(speaker_id: object) -> str:
        """Normalize a raw speaker_id (int/str/None) to a stable dict key."""
        return "?" if speaker_id is None else str(speaker_id)

    def _anon_label(self, key: str) -> str:
        """Return a stable anonymous "Speaker N" label for a diarization key."""
        with self._lock:
            label = self._anon.get(key)
            if label is None:
                label = f"Speaker {self._next_speaker_no}"
                self._next_speaker_no += 1
                self._anon[key] = label
            return label

    def _write_header(self) -> None:
        title = self.meeting_title or "(untitled)"
        self._fh.write(
            f"{'=' * 60}\n"
            f"MEETING TRANSCRIPT\n"
            f"Title:   {title}\n"
            f"Room:    {self.room_name}\n"
            f"Started: {self._started_at:%Y-%m-%d %H:%M:%S}\n"
            f"{'=' * 60}\n\n"
        )
        self._fh.flush()

    def _write_line(self, label: str, text: str, when: datetime | None) -> None:
        when = when or datetime.now()
        line = f"[{when:%H:%M:%S}] {label}: {text}\n"
        with self._lock:
            if self._closed:
                logger.warning("Transcript already closed; dropping line: %r", text)
                return
            self._fh.write(line)
            self._fh.flush()

    @staticmethod
    def _format_duration(seconds: float) -> str:
        total = int(seconds)
        h, rem = divmod(total, 3600)
        m, s = divmod(rem, 60)
        if h:
            return f"{h}h {m}m {s}s"
        if m:
            return f"{m}m {s}s"
        return f"{s}s"
