const { ApiError } = require('../../utils/ApiError');
const groqClient = require('../voice/voice.groqClient');

/**
 * The AI "brain" for the global Workspace Assistant. It does NOT touch the
 * database — it only turns a natural-language message (plus a snapshot of the
 * workspace the client sends as `context`) into a structured PLAN of actions.
 * The frontend's action layer resolves those actions against existing APIs.
 *
 * Reuses the same Groq JSON chat call the voice feature uses, so no new AI infra.
 */

const SYSTEM_PROMPT = `You are Kuberya's Workspace Assistant. Convert the user's request into a JSON plan of actions.
You NEVER execute anything yourself — you only emit structured actions that the app will run against its APIs.

Return ONLY a JSON object with this exact shape:
{
  "reply": "one short, friendly sentence describing what you'll do (or the answer for a query)",
  "actions": [ ...Action ],
  "needsConfirmation": boolean,
  "confirmationPrompt": "shown before destructive/bulk actions, else empty string"
}

Each Action is one of (include only the fields shown):
{ "type": "create_project", "name": string }
{ "type": "rename_project", "project": string, "name": string }
{ "type": "archive_project", "project": string }
{ "type": "delete_project", "project": string }
{ "type": "create_task", "title": string, "project"?: string, "assignee"?: string, "dueDate"?: "YYYY-MM-DD", "status"?: string, "priority"?: "urgent"|"high"|"normal"|"low" }
{ "type": "update_task", "task": string, "project"?: string, "title"?: string, "assignee"?: string, "dueDate"?: "YYYY-MM-DD" }
{ "type": "delete_task", "task": string, "project"?: string }
{ "type": "set_status", "status": string, "task"?: string, "filter"?: Filter }
{ "type": "set_priority", "priority": "urgent"|"high"|"normal"|"low", "task"?: string, "filter"?: Filter }
{ "type": "set_assignee", "assignee": string, "task"?: string, "filter"?: Filter }
{ "type": "set_due", "dueDate": "YYYY-MM-DD", "task"?: string, "filter"?: Filter }
{ "type": "create_status", "project": string, "name": string, "color"?: string, "group"?: "not_started"|"active"|"done" }
{ "type": "rename_status", "project": string, "status": string, "name": string }
{ "type": "delete_status", "project": string, "status": string }
{ "type": "query", "title": string, "filter": Filter }
{ "type": "summarize", "project"?: string }
{ "type": "workload" }
{ "type": "overdue" }

Filter (all optional): { "project"?: string, "assignee"?: string, "status"?: string, "priority"?: string, "overdue"?: boolean, "dueThisWeek"?: boolean, "dueToday"?: boolean, "text"?: string }

RULES:
- Use the provided context (projects, users, statuses, today's date) to fill names and resolve relative dates (e.g. "next Friday") to YYYY-MM-DD.
- For bulk requests ("all overdue tasks", "all frontend tasks") use a single action with a "filter" and NO "task".
- Use "text" in a filter to match task titles by keyword (e.g. "frontend").
- Set needsConfirmation=true and write a clear confirmationPrompt for: delete_project, delete_task, delete_status, and any bulk mutation via filter.
- For "show me / list / what are" requests use a "query" action. For progress/summary use "summarize"; team load use "workload".
- Keep "reply" to one sentence. Output valid JSON only — no markdown, no commentary.`;

function buildPrompt(message, context) {
  return {
    system: SYSTEM_PROMPT,
    user: `Context:\n${JSON.stringify(context)}\n\nUser request: ${message}`,
  };
}

function safeParse(raw) {
  try {
    const obj = JSON.parse(raw);
    return {
      reply: typeof obj.reply === 'string' ? obj.reply : 'Done.',
      actions: Array.isArray(obj.actions) ? obj.actions : [],
      needsConfirmation: Boolean(obj.needsConfirmation),
      confirmationPrompt: typeof obj.confirmationPrompt === 'string' ? obj.confirmationPrompt : '',
    };
  } catch {
    throw new ApiError(502, 'The assistant returned an unreadable response. Please rephrase and try again.');
  }
}

async function runCommand({ message, context }, client = groqClient) {
  if (!message || !message.trim()) throw new ApiError(400, 'A message is required.');
  const prompt = buildPrompt(message.trim(), context || {});
  const raw = await client.extractTaskFields(prompt); // reuses voice's Groq JSON call
  return safeParse(raw);
}

module.exports = { runCommand, buildPrompt, safeParse };
