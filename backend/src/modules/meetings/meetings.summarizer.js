const env = require('../../config/env');

const GROQ_BASE = 'https://api.groq.com/openai/v1';

/**
 * Best-effort AI summary of a meeting transcript, generated on the Node side via
 * Groq. This is a FALLBACK: the external Meeting Bot (server.py) already
 * summarizes the transcript when a call ends, so this only runs when the bot
 * returned a transcript but no summary (e.g. GROQ_API_KEY is set here but not on
 * the bot service).
 *
 * Deliberately never throws — a missing key, empty transcript, or a failed call
 * all return '' so the caller can still surface the raw transcript. The prompt
 * mirrors the bot's own (server.py summarize_transcript) so the two produce the
 * same shape of summary.
 */
async function summarizeTranscript(transcriptText) {
  const text = (transcriptText || '').trim();
  if (!env.groqApiKey || !text) return '';

  const instructions =
    'Summarize the following meeting transcript for someone who missed it. Use ' +
    "short markdown sections with these headings: '## Overview' (2-3 sentences), " +
    "'## Key Points' (bullets), '## Decisions' (bullets, or 'None') and " +
    "'## Action Items' (bullets naming the owner when stated, or 'None'). Be " +
    'concise and only use what the transcript actually says.';

  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You write clear, structured meeting summaries.' },
          { role: 'user', content: `${instructions}\n\nTRANSCRIPT:\n${text}` },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[meetings] Groq summary failed:', res.status, detail.slice(0, 300));
      return '';
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    console.error('[meetings] Groq summary error:', err.message);
    return '';
  }
}

// A transcript line looks like: "[HH:MM:SS] Speaker 1: hello there".
const TRANSCRIPT_LINE = /^\[\d{2}:\d{2}:\d{2}\]\s+([^:]+):/;

// The facilitator's own lines are labelled "Agent" (transcript.py AGENT_LABEL);
// it isn't a meeting attendee, so it's excluded from the "who spoke" count.
const AGENT_LABEL = 'Agent';

/**
 * Distinct human speaker labels heard in the transcript, in first-heard order.
 *
 * Attendance is never reported to us (Meeting BaaS speaker events aren't
 * captured), so this is the closest honest proxy for "who took part": the
 * diarized speakers Deepgram attributed lines to — real names when the bridge
 * learned them, otherwise "Speaker N"/"Participant". It counts who *spoke*, not
 * who merely joined and stayed silent.
 */
function extractSpeakers(transcriptText) {
  const seen = new Set();
  const order = [];
  for (const raw of (transcriptText || '').split('\n')) {
    const match = raw.match(TRANSCRIPT_LINE);
    if (!match) continue;
    const label = match[1].trim();
    if (label === AGENT_LABEL || seen.has(label)) continue;
    seen.add(label);
    order.push(label);
  }
  return order;
}

module.exports = { summarizeTranscript, extractSpeakers };
