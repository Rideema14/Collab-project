const env = require('../../config/env');
const { ApiError } = require('../../utils/ApiError');

/**
 * The HTTP boundary between Kuberya and the external Meeting Bot service
 * (the Python/FastAPI app in this repo: backend/meeting.py, port 8000).
 *
 * Kuberya owns the domain and builds the context snapshot; the bot owns joining
 * the call, running the agenda, and transcribing. This module is the only place
 * that knows the bot exists — per the architecture note that the two services
 * talk over public APIs and never share tables.
 *
 * The bot consumes a MeetingBotContext exactly as `buildContextPackage` emits it
 * (schemaVersion/meeting/narrative/...), so the frozen snapshot is forwarded
 * verbatim — no reshaping here for the two shapes to drift apart.
 */

/** How long to wait for the bot to accept the job before giving up. */
const DEPLOY_TIMEOUT_MS = 20000;

/** How long to wait for the (fast, in-memory) result lookup before giving up. */
const RESULT_TIMEOUT_MS = 8000;

function assertConfigured() {
  if (!env.meetingBotUrl) {
    throw new ApiError(
      503,
      'The Meeting Bot service is not configured on this server. Set MEETING_BOT_URL to enable deploying a bot into meetings.'
    );
  }
}

/**
 * Ask the Meeting Bot to join this meeting's call.
 *
 * Resolves once the bot service has accepted the job — it has created the bot
 * with its meeting provider and dispatched its agent. That is NOT the same as
 * the bot being admitted into the call, which happens later and asynchronously.
 *
 * Throws ApiError on any failure, which deliberately fails the whole deploy:
 * a meeting must never be recorded as deployed when no bot actually joined.
 *
 * @param {number} meetingId
 * @param {object} context - the frozen MeetingBotContext snapshot
 * @returns {Promise<{deployed: boolean, deployedAt: string, botId: string|null, room: string|null}>}
 */
async function deployBot(meetingId, context) {
  assertConfigured();

  let res;
  try {
    res = await fetch(`${env.meetingBotUrl}/api/meetings/${meetingId}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      // Without this, a hung bot service would hold the HTTP request open until
      // the caller's own timeout — the admin would watch a spinner with no idea
      // whether a bot was joining.
      signal: AbortSignal.timeout(DEPLOY_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new ApiError(
        504,
        'The Meeting Bot service did not respond in time. The bot may or may not have joined — check the meeting before retrying.'
      );
    }
    console.error('[meetingBot] unreachable at', env.meetingBotUrl, '-', err.message);
    throw new ApiError(
      502,
      'Could not reach the Meeting Bot service. Is it running? The meeting was not deployed.'
    );
  }

  if (!res.ok) {
    // FastAPI errors are {detail: string}; surface the bot's own reason rather
    // than a generic one, since it explains actionable cases like "this meeting
    // has no meeting link".
    let detail = '';
    try {
      const body = await res.json();
      detail = typeof body?.detail === 'string' ? body.detail : '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    console.error('[meetingBot] deploy failed:', res.status, detail);
    throw new ApiError(
      res.status === 400 ? 400 : 502,
      detail || 'The Meeting Bot service rejected the deploy request.'
    );
  }

  return res.json();
}

/**
 * Fetch the transcript + AI summary the bot produced for a meeting.
 *
 * The bot exposes GET /api/meetings/{id}/result, which returns {"ended": false}
 * until the call finishes and then {ended, transcript, summary}. This is a
 * best-effort read used by a detail page that must still render if the bot
 * service is down or not configured — so, unlike deployBot, it never throws:
 * any failure (unconfigured, unreachable, timeout, non-2xx) degrades to
 * {ended: false}, which the caller treats as "no result yet".
 *
 * @param {number} meetingId
 * @returns {Promise<{ended: boolean, transcript?: string, summary?: string}>}
 */
async function getResult(meetingId) {
  if (!env.meetingBotUrl) return { ended: false };

  try {
    const res = await fetch(`${env.meetingBotUrl}/api/meetings/${meetingId}/result`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(RESULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[meetingBot] result fetch failed:', res.status);
      return { ended: false };
    }
    const body = await res.json();
    return body && typeof body === 'object' ? body : { ended: false };
  } catch (err) {
    console.error('[meetingBot] could not fetch result for meeting', meetingId, '-', err.message);
    return { ended: false };
  }
}

module.exports = { deployBot, getResult };
