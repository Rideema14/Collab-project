const { ApiError } = require('../../utils/ApiError');

function buildExtractionPrompt(transcript, teamMembers, todayIso) {
  const roster = teamMembers.map((m) => `- ${m.name} (${m.email})`).join('\n') || '(no team members yet)';

  const system = `You convert a short spoken task-assignment command into structured JSON for a task board.
Respond with ONLY a JSON object, no markdown fences and no commentary, in exactly this shape:
{
  "title": string,
  "assigneeNameHeard": string or null,
  "assigneeName": string or null,
  "dueDate": string or null
}

Rules:
- "title" is a short, clear task description. Strip phrasing like "assign X to Y" or "remind Y to" down to the task itself.
- "assigneeNameHeard" is whatever name or reference to a person you heard in the transcript, verbatim, or null if no one was mentioned.
- "assigneeName" is the single closest matching full name from the team roster below, or null if you are not confident there is a match. Only choose a name that appears in the roster.
- "dueDate" is an ISO date (YYYY-MM-DD) if a date or deadline was mentioned, resolving relative phrases like "tomorrow" or "next Friday" using today's date below. Use null if no date was mentioned.

Today's date: ${todayIso}

Team roster:
${roster}`;

  return { system, user: transcript };
}

function parseExtractionResponse(rawText) {
  const cleaned = String(rawText ?? '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new ApiError(
      502,
      'Voice parsing service returned an unreadable response. Please try again or use the manual form.'
    );
  }

  return {
    title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    assigneeNameHeard: parsed.assigneeNameHeard || null,
    assigneeName: parsed.assigneeName || null,
    dueDate: parsed.dueDate || null,
  };
}

/**
 * Deterministically resolves a name guess (from the LLM) to a real team member.
 * Tries, in order: exact full name, exact first name, email local-part, substring.
 * Never trusts the LLM's pick blindly — only returns a member that's actually on the roster.
 */
function resolveAssignee(nameGuess, teamMembers) {
  if (!nameGuess) return null;
  const normalized = String(nameGuess).trim().toLowerCase();
  if (!normalized) return null;

  return (
    teamMembers.find((m) => m.name.toLowerCase() === normalized) ||
    teamMembers.find((m) => m.name.toLowerCase().split(' ')[0] === normalized) ||
    teamMembers.find((m) => m.email.toLowerCase().split('@')[0] === normalized) ||
    teamMembers.find((m) => m.name.toLowerCase().includes(normalized)) ||
    null
  );
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

module.exports = { buildExtractionPrompt, parseExtractionResponse, resolveAssignee, isValidIsoDate };
