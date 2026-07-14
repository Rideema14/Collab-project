const { ApiError } = require('../../utils/ApiError');
const usersService = require('../users/users.service');
const tasksService = require('../tasks/tasks.service');
const defaultClient = require('./voice.groqClient');
const {
  buildExtractionPrompt,
  parseExtractionResponse,
  resolveAssignee,
  isValidIsoDate,
} = require('./voice.parser');

/**
 * Turns a voice command (already-transcribed text, or raw audio) into a
 * structured draft: title, resolved assignee, due date, plus any warnings
 * about things it couldn't confidently work out.
 *
 * `client` defaults to the real Groq client but can be swapped for a fake
 * one in tests, so this whole pipeline is testable without network access.
 */
async function parseVoiceCommand({ transcript, audioBuffer, audioMimeType }, client = defaultClient) {
  const text = transcript && transcript.trim() ? transcript.trim() : await client.transcribeAudio(audioBuffer, audioMimeType);

  if (!text) {
    throw new ApiError(422, "Didn't catch a task in that recording. Please try again or use the manual form.");
  }

  const teamMembers = await usersService.listMembers();
  const todayIso = new Date().toISOString().slice(0, 10);
  const prompt = buildExtractionPrompt(text, teamMembers, todayIso);
  const raw = await client.extractTaskFields(prompt);
  const extracted = parseExtractionResponse(raw);

  if (!extracted.title) {
    throw new ApiError(422, "Couldn't make out a task title from that. Please try again or use the manual form.");
  }

  const warnings = [];

  const assignee = resolveAssignee(extracted.assigneeName, teamMembers);
  if (extracted.assigneeNameHeard && !assignee) {
    warnings.push(`Could not confidently match "${extracted.assigneeNameHeard}" to a team member — left unassigned.`);
  }

  let dueDate = extracted.dueDate;
  if (dueDate && !isValidIsoDate(dueDate)) {
    warnings.push(`Could not resolve a valid due date from "${dueDate}" — left blank.`);
    dueDate = null;
  }

  return {
    transcript: text,
    title: extracted.title,
    assignee,
    assigneeNameHeard: extracted.assigneeNameHeard,
    dueDate,
    warnings,
  };
}

/**
 * Parses the command AND creates the task, by calling the exact same
 * tasksService.createTask() the manual "Add task" form uses. Voice is just
 * a second way to fill in that one form — not a parallel code path.
 */
async function createTaskFromVoice({ projectId, transcript, audioBuffer, audioMimeType }, client = defaultClient) {
  const parsed = await parseVoiceCommand({ transcript, audioBuffer, audioMimeType }, client);

  const task = await tasksService.createTask({
    projectId,
    title: parsed.title,
    assigneeId: parsed.assignee ? parsed.assignee.id : null,
    dueDate: parsed.dueDate,
  });

  return {
    task,
    voice: {
      transcript: parsed.transcript,
      assigneeNameHeard: parsed.assigneeNameHeard,
      warnings: parsed.warnings,
    },
  };
}

module.exports = { parseVoiceCommand, createTaskFromVoice };
