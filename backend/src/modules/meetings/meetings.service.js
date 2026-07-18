const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../utils/auditLog');
const repository = require('./meetings.repository');
const mailer = require('../../utils/email');
const botClient = require('./meetings.botClient');
const summarizer = require('./meetings.summarizer');

const MEETING_TYPES = ['Daily Standup', 'Weekly Review', 'Sprint Review', 'Custom'];

// This backend has no status-history ledger, no comments table, and no task
// dependency table (see docs/MEETING_BOT_ARCHITECTURE.md, Phase 0). A context
// package generated here is therefore a *current-state snapshot*, not a
// time-windowed diff — it cannot say what changed "since the last meeting".
// Every generated package carries this list so nothing is silently implied.
const CONTEXT_LIMITATIONS = [
  "Status-change history isn't tracked yet, so this reflects each participant's current task state only — not what changed since the last meeting.",
  'Comments are stored in the browser only today and are not included.',
  "\"Blocked\" is a heuristic based on a task's status being literally named Blocked — there is no real dependency graph behind it.",
];

function shapeMeeting(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    scheduledAt: row.scheduled_at,
    meetingUrl: row.meeting_url,
    status: row.status,
    deployedAt: row.deployed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: { id: row.created_by_id, name: row.created_by_name, email: row.created_by_email },
  };
}

// email_status/email_error/etc come from findParticipants' LATERAL join onto
// each recipient's most recent email_logs row; null when no send has been
// attempted yet (e.g. a participant added but the send step hasn't run).
function shapeParticipant(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    inviteStatus: row.invite_status,
    invitedAt: row.invited_at,
    emailStatus: row.email_status ?? 'pending',
    emailError: row.email_error ?? null,
    emailSentAt: row.email_sent_at ?? null,
    emailDeliveredAt: row.email_delivered_at ?? null,
  };
}

function shapeContextTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    status: row.status,
    dueDate: row.due_date,
    isOverdue: row.is_overdue,
  };
}

function validateType(type) {
  if (type === undefined || type === null || type === '') return 'Custom';
  if (!MEETING_TYPES.includes(type)) {
    throw new ApiError(400, `Meeting type must be one of: ${MEETING_TYPES.join(', ')}`);
  }
  return type;
}

function validateScheduledAt(value) {
  if (!value) throw new ApiError(400, 'scheduledAt is required');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'scheduledAt must be a valid date/time');
  }
  return date.toISOString();
}

const MAX_MEETING_URL_LEN = 2048;
function validateMeetingUrl(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ApiError(400, 'Meeting link is required');
    return null;
  }
  const trimmed = String(value).trim();
  if (trimmed.length > MAX_MEETING_URL_LEN) {
    throw new ApiError(400, `Meeting link must be ${MAX_MEETING_URL_LEN} characters or fewer`);
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new ApiError(400, 'Meeting link must be a valid http(s) URL');
  }
  return trimmed;
}

function validateIdArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, `${fieldName} must be a non-empty array`);
  }
  const ids = value.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new ApiError(400, `${fieldName} must contain valid ids`);
  }
  return ids;
}

function isoDateNDaysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Sends one email and durably records the outcome in email_logs, driving
 * meeting_participants.invite_status off the SAME attempt — this is the only
 * place either of those gets written, replacing the old
 * `.catch(console.error)` swallow that made every send look successful to
 * callers no matter what actually happened with the provider.
 */
async function sendAndLogEmail(meetingRow, participant, subject, body) {
  const log = await repository.createEmailLog({
    meetingId: meetingRow.id,
    recipientEmail: participant.email,
    subject,
    provider: 'emailjs',
  });
  await repository.updateEmailLog(log.id, { status: 'sending' });

  try {
    await mailer.send({ to: participant.email, subject, body });
    await repository.updateEmailLog(log.id, { status: 'sent', sentAt: new Date().toISOString() });
    await repository.setParticipantInviteStatus(meetingRow.id, participant.email, 'sent');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error';
    await repository.updateEmailLog(log.id, { status: 'failed', errorMessage: message });
    await repository.setParticipantInviteStatus(meetingRow.id, participant.email, 'failed');
    console.error(`[meetings] failed to send "${subject}" to ${participant.email}:`, message);
  }
}

async function sendInviteEmails(meetingRow, participants) {
  const when = new Date(meetingRow.scheduled_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const linkLine = meetingRow.meeting_url ? `\nJoin: ${meetingRow.meeting_url}` : '';
  const subject = `Meeting invite: ${meetingRow.title}`;
  const body = `You've been invited to "${meetingRow.title}" (${meetingRow.type}) on ${when}.${linkLine}`;
  await Promise.all(participants.map((p) => sendAndLogEmail(meetingRow, p, subject, body)));
}

async function sendCancellationEmails(meetingRow, participants) {
  const subject = `Meeting cancelled: ${meetingRow.title}`;
  const body = `"${meetingRow.title}" has been cancelled.`;
  await Promise.all(participants.map((p) => sendAndLogEmail(meetingRow, p, subject, body)));
}

/**
 * Per-participant task breakdown, scoped to `projectIds`: assigned tasks,
 * completed tasks (status === 'Done' — the same convention tasks.repository
 * already uses for is_overdue), active tasks (not done, not overdue), overdue
 * tasks, and upcoming deadlines (due within 7 days). Shared by both the
 * meeting-scoped context package (buildContextPackage) and the pre-creation
 * preview (previewContext) — same computation either way, just fed different
 * project/participant lists.
 */
async function buildParticipantSections(projectIds, participants) {
  const today = isoDateNDaysFromNow(0);
  const weekAhead = isoDateNDaysFromNow(7);

  return Promise.all(
    participants.map(async (p) => {
      const rows = await repository.findTasksForAssignee(p.id, projectIds);
      const tasks = rows.map(shapeContextTask);
      const completedTasks = tasks.filter((t) => t.status === 'Done');
      const overdueTasks = tasks.filter((t) => t.isOverdue);
      // Heuristic: no dependency graph exists yet (see CONTEXT_LIMITATIONS), so
      // "blocked" is read off a status literally named Blocked, same free-text
      // status convention as everything else — not a real dependency check.
      const blockedTasks = tasks.filter((t) => t.status.trim().toLowerCase() === 'blocked');
      const activeTasks = tasks.filter((t) => t.status !== 'Done' && !t.isOverdue && !blockedTasks.includes(t));
      const upcomingDeadlines = tasks.filter(
        (t) => t.dueDate && !t.isOverdue && t.status !== 'Done' && t.dueDate >= today && t.dueDate <= weekAhead
      );
      return {
        userId: p.id,
        name: p.name,
        email: p.email,
        assignedTasks: tasks,
        completedTasks,
        activeTasks,
        blockedTasks,
        overdueTasks,
        upcomingDeadlines,
      };
    })
  );
}

/** Stamps each task in a participant section with who it's assigned to, for flat (non-nested) tables. */
function withAssignee(tasks, section) {
  return tasks.map((t) => ({ ...t, assigneeId: section.userId, assigneeName: section.name }));
}

function flattenSections(participantSections) {
  return {
    assignedTasks: participantSections.flatMap((s) => withAssignee(s.assignedTasks, s)),
    completedTasks: participantSections.flatMap((s) => withAssignee(s.completedTasks, s)),
    activeTasks: participantSections.flatMap((s) => withAssignee(s.activeTasks, s)),
    blockedTasks: participantSections.flatMap((s) => withAssignee(s.blockedTasks, s)),
    overdueTasks: participantSections.flatMap((s) => withAssignee(s.overdueTasks, s)),
    deadlines: participantSections.flatMap((s) => withAssignee(s.upcomingDeadlines, s)),
  };
}

function daysBetween(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.max(1, Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000));
}

function taskList(tasks) {
  return tasks.map((t) => `"${t.title}" (${t.projectName})`).join(', ');
}

/**
 * Turns the same structured context data into ONE plain-text, paragraph-based
 * prompt meant to be fed directly to an LLM by the external Meeting Bot. Pure
 * deterministic string formatting — no AI call happens here, and nothing in
 * this text is a generated summary, agenda, or recommendation; it only
 * restates the underlying data in prose instead of tables. "Discussion
 * points" below are a plain, mechanical enumeration of overdue/blocked items,
 * not an AI-inferred judgment of what matters.
 */
function buildNarrative({ meeting, participants, projects, assignedTasks, completedTasks, activeTasks, blockedTasks, overdueTasks, deadlines, limitations }) {
  const today = isoDateNDaysFromNow(0);
  const paragraphs = [];

  const when = new Date(meeting.scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  paragraphs.push(`Meeting: ${meeting.title} (${meeting.type}). Scheduled for ${when}.`);

  const participantNames = participants.map((p) => p.name).join(', ') || 'no participants';
  const projectNames = projects.map((p) => p.name).join(', ') || 'no projects';
  paragraphs.push(
    `This meeting has ${participants.length} participant(s): ${participantNames}. It covers ${projects.length} project(s): ${projectNames}.`
  );

  for (const p of participants) {
    const mine = (arr) => arr.filter((t) => t.assigneeId === p.id);
    const assigned = mine(assignedTasks);
    const completed = mine(completedTasks);
    const active = mine(activeTasks);
    const blocked = mine(blockedTasks);
    const overdue = mine(overdueTasks);
    const due = mine(deadlines);

    const bits = [];
    bits.push(`${p.name} has ${assigned.length} assigned task(s) across the covered projects.`);
    bits.push(completed.length ? `Completed: ${taskList(completed)}.` : 'No completed tasks.');
    bits.push(active.length ? `In progress: ${taskList(active)}.` : 'Nothing currently in progress.');
    bits.push(blocked.length ? `Blocked: ${taskList(blocked)}.` : 'No blocked tasks.');
    bits.push(
      overdue.length
        ? `Overdue: ${overdue.map((t) => `"${t.title}" (${t.projectName}, ${daysBetween(t.dueDate, today)} day(s) overdue)`).join(', ')}.`
        : 'Nothing overdue.'
    );
    bits.push(due.length ? `Due within the next 7 days: ${taskList(due)}.` : 'No deadlines in the next 7 days.');
    paragraphs.push(bits.join(' '));
  }

  const projectSummaries = projects.map((proj) => {
    const inProj = (arr) => arr.filter((t) => t.projectId === proj.id);
    const total = inProj(assignedTasks).length;
    const done = inProj(completedTasks).length;
    const over = inProj(overdueTasks).length;
    const blocked = inProj(blockedTasks).length;
    return `${proj.name}: ${total} task(s) total, ${done} completed, ${over} overdue, ${blocked} blocked.`;
  });
  if (projectSummaries.length) paragraphs.push(`Project summaries: ${projectSummaries.join(' ')}`);

  const discussion = [];
  for (const t of overdueTasks) {
    discussion.push(`"${t.title}" (${t.projectName}) is overdue by ${daysBetween(t.dueDate, today)} day(s), assigned to ${t.assigneeName}.`);
  }
  for (const t of blockedTasks) {
    discussion.push(`"${t.title}" (${t.projectName}) is marked Blocked, assigned to ${t.assigneeName}.`);
  }
  paragraphs.push(
    discussion.length
      ? `Discussion points: ${discussion.join(' ')}`
      : 'Discussion points: nothing overdue or blocked across the covered projects.'
  );

  paragraphs.push(`Limitations of this context: ${limitations.join(' ')}`);

  return paragraphs.join('\n\n');
}

/**
 * Builds the meeting context package from current task state — a flat,
 * structured data dump for an external Meeting Bot to consume. Deliberately
 * contains no agenda, summary, questions, risks, or recommendations; it is
 * only current-state task data (see CONTEXT_LIMITATIONS for what's excluded).
 */
async function buildContextPackage(meetingRow) {
  const [projects, participants] = await Promise.all([
    repository.findProjects(meetingRow.id),
    repository.findParticipants(meetingRow.id),
  ]);
  const participantSections = await buildParticipantSections(
    projects.map((p) => p.id),
    participants
  );

  const payload = {
    schemaVersion: 3,
    meetingId: meetingRow.id,
    generatedAt: new Date().toISOString(),
    meeting: shapeMeeting(meetingRow),
    participants: participants.map(shapeParticipant),
    projects: projects.map((pr) => ({ id: pr.id, name: pr.name })),
    limitations: CONTEXT_LIMITATIONS,
    ...flattenSections(participantSections),
  };
  payload.narrative = buildNarrative(payload);
  return payload;
}

/**
 * Same computation as buildContextPackage, but for a meeting that doesn't
 * exist yet — used to preview each invitee's task breakdown live while an
 * admin is still picking projects/participants on the schedule form.
 */
async function previewContext({ projectIds, participantUserIds, organizationId }) {
  const cleanProjectIds = validateIdArray(projectIds, 'projectIds');
  const cleanParticipantIds = validateIdArray(participantUserIds, 'participantUserIds');

  const [projects, participants] = await Promise.all([
    repository.findProjectsByIds(cleanProjectIds, organizationId),
    repository.findUsersByIds(cleanParticipantIds, organizationId),
  ]);
  const participantSections = await buildParticipantSections(
    projects.map((p) => p.id),
    participants
  );

  return {
    schemaVersion: 1,
    meetingId: null,
    generatedAt: new Date().toISOString(),
    projects: projects.map((pr) => ({ id: pr.id, name: pr.name })),
    limitations: CONTEXT_LIMITATIONS,
    participants: participantSections,
  };
}

async function createMeeting({ title, type, scheduledAt, meetingUrl, projectIds, participantUserIds, createdBy, organizationId }) {
  if (!title || !title.trim()) {
    throw new ApiError(400, 'Meeting title is required');
  }
  const cleanType = validateType(type);
  const cleanScheduledAt = validateScheduledAt(scheduledAt);
  const cleanMeetingUrl = validateMeetingUrl(meetingUrl, { required: true });
  const cleanProjectIds = validateIdArray(projectIds, 'projectIds');
  const cleanParticipantIds = validateIdArray(participantUserIds, 'participantUserIds');

  // Scope both lists to the caller's own org before persisting the association —
  // closes the same gap previewContext had (see meetings.repository.js).
  const [scopedProjects, scopedParticipants] = await Promise.all([
    repository.findProjectsByIds(cleanProjectIds, organizationId),
    repository.findUsersByIds(cleanParticipantIds, organizationId),
  ]);
  if (!scopedProjects.length) throw new ApiError(400, 'projectIds must reference real projects in your organization');
  if (!scopedParticipants.length) throw new ApiError(400, 'participantUserIds must reference real users in your organization');

  const meetingRow = await repository.create({
    title: title.trim(),
    type: cleanType,
    scheduledAt: cleanScheduledAt,
    meetingUrl: cleanMeetingUrl,
    createdBy,
    organizationId,
  });
  await repository.setProjects(meetingRow.id, scopedProjects.map((p) => p.id));
  await repository.setParticipants(meetingRow.id, scopedParticipants.map((p) => p.id));
  logAudit({ organizationId, actorId: createdBy, action: 'meeting.create', targetType: 'meeting', targetId: meetingRow.id }).catch(
    (err) => console.error('[audit] failed to log meeting.create:', err)
  );

  const participants = await repository.findParticipants(meetingRow.id);
  await sendInviteEmails(meetingRow, participants);

  return getMeetingDetail(meetingRow.id);
}

async function listMeetings(organizationId) {
  const rows = await repository.findAll(organizationId);
  return Promise.all(
    rows.map(async (row) => {
      const [projects, participants] = await Promise.all([
        repository.findProjects(row.id),
        repository.findParticipants(row.id),
      ]);
      return {
        ...shapeMeeting(row),
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
        participants: participants.map(shapeParticipant),
      };
    })
  );
}

async function getMeetingDetail(id) {
  const row = await repository.findById(id);
  if (!row) throw new ApiError(404, 'Meeting not found');

  const [projects, participants] = await Promise.all([
    repository.findProjects(id),
    repository.findParticipants(id),
  ]);
  return {
    ...shapeMeeting(row),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    participants: participants.map(shapeParticipant),
  };
}

async function updateMeeting(id, fields) {
  const existing = await repository.findById(id);
  if (!existing) throw new ApiError(404, 'Meeting not found');
  if (existing.status === 'cancelled') {
    throw new ApiError(400, 'Cannot edit a cancelled meeting');
  }

  const updates = {};
  if (fields.title !== undefined) {
    if (!fields.title.trim()) throw new ApiError(400, 'Meeting title cannot be empty');
    updates.title = fields.title.trim();
  }
  if (fields.type !== undefined) {
    updates.type = validateType(fields.type);
  }
  if (fields.scheduledAt !== undefined) {
    updates.scheduledAt = validateScheduledAt(fields.scheduledAt);
  }
  if (fields.meetingUrl !== undefined) {
    updates.meetingUrl = validateMeetingUrl(fields.meetingUrl, { required: true });
  }

  if (fields.projectIds !== undefined) {
    const cleanProjectIds = validateIdArray(fields.projectIds, 'projectIds');
    const scopedProjects = await repository.findProjectsByIds(cleanProjectIds, existing.organization_id);
    if (!scopedProjects.length) throw new ApiError(400, 'projectIds must reference real projects in your organization');
    await repository.setProjects(id, scopedProjects.map((p) => p.id));
  }

  // Only email participants who are newly added by this edit — re-inviting
  // everyone on every edit would be noisy for people already on the list.
  let newlyAdded = [];
  if (fields.participantUserIds !== undefined) {
    const before = new Set((await repository.findParticipants(id)).map((p) => p.id));
    const cleanParticipantIds = validateIdArray(fields.participantUserIds, 'participantUserIds');
    const scopedParticipants = await repository.findUsersByIds(cleanParticipantIds, existing.organization_id);
    if (!scopedParticipants.length) throw new ApiError(400, 'participantUserIds must reference real users in your organization');
    await repository.setParticipants(id, scopedParticipants.map((p) => p.id));
    newlyAdded = scopedParticipants.map((p) => p.id).filter((pid) => !before.has(pid));
  }

  if (Object.keys(updates).length > 0) {
    await repository.update(id, updates);
  }

  if (newlyAdded.length > 0) {
    const meetingRow = await repository.findById(id);
    const allParticipants = await repository.findParticipants(id);
    const added = allParticipants.filter((p) => newlyAdded.includes(p.id));
    await sendInviteEmails(meetingRow, added);
  }

  return getMeetingDetail(id);
}

async function cancelMeeting(id, actorId) {
  const existing = await repository.findById(id);
  if (!existing) throw new ApiError(404, 'Meeting not found');
  if (existing.status === 'cancelled') return getMeetingDetail(id);

  await repository.updateStatus(id, 'cancelled');
  const participants = await repository.findParticipants(id);
  await sendCancellationEmails(existing, participants);
  logAudit({
    organizationId: existing.organization_id,
    actorId,
    action: 'meeting.cancel',
    targetType: 'meeting',
    targetId: id,
  }).catch((err) => console.error('[audit] failed to log meeting.cancel:', err));

  return getMeetingDetail(id);
}

/**
 * Re-runs the invite send for every current participant, creating a fresh
 * email_logs row per recipient (a new attempt — prior rows stay as history)
 * and updating invite_status off that new attempt. Used for both "nothing
 * arrived the first time" and "I added someone after the initial invite."
 */
async function resendInvitations(id, actorId) {
  const existing = await repository.findById(id);
  if (!existing) throw new ApiError(404, 'Meeting not found');
  if (existing.status === 'cancelled') {
    throw new ApiError(400, 'Cannot resend invitations for a cancelled meeting');
  }

  const participants = await repository.findParticipants(id);
  if (!participants.length) throw new ApiError(400, 'This meeting has no participants to invite');

  await sendInviteEmails(existing, participants);
  logAudit({
    organizationId: existing.organization_id,
    actorId,
    action: 'meeting.invite.resend',
    targetType: 'meeting',
    targetId: id,
  }).catch((err) => console.error('[audit] failed to log meeting.invite.resend:', err));

  return getMeetingDetail(id);
}

async function deleteMeeting(id, actorId) {
  const existing = await repository.findById(id);
  if (!existing) throw new ApiError(404, 'Meeting not found');

  await repository.remove(id);
  logAudit({
    organizationId: existing.organization_id,
    actorId,
    action: 'meeting.delete',
    targetType: 'meeting',
    targetId: id,
  }).catch((err) => console.error('[audit] failed to log meeting.delete:', err));
}

async function generateContext(id) {
  const meetingRow = await repository.findById(id);
  if (!meetingRow) throw new ApiError(404, 'Meeting not found');
  if (meetingRow.status === 'cancelled') {
    throw new ApiError(400, 'Cannot generate context for a cancelled meeting');
  }

  const payload = await buildContextPackage(meetingRow);
  const saved = await repository.upsertContextPackage(id, payload);
  if (meetingRow.status === 'scheduled') {
    await repository.updateStatus(id, 'context_ready');
  }
  return { meetingId: saved.meeting_id, generatedAt: saved.generated_at, payload: saved.payload };
}

async function getContext(id) {
  const meetingRow = await repository.findById(id);
  if (!meetingRow) throw new ApiError(404, 'Meeting not found');

  const pkg = await repository.getContextPackage(id);
  if (!pkg) throw new ApiError(404, 'No context package has been generated for this meeting yet');
  return { meetingId: pkg.meeting_id, generatedAt: pkg.generated_at, payload: pkg.payload };
}

/**
 * Deploys a meeting to the external Meeting Bot: builds a fresh context
 * snapshot, stores it (separately from meeting_context_packages, which keeps
 * updating on every "Regenerate" — this snapshot is frozen at the moment of
 * deploy), sends it to the bot service so it actually joins the call, and stamps
 * meetings.deployed_at.
 */
async function deployMeeting(id, actorId) {
  const meetingRow = await repository.findById(id);
  if (!meetingRow) throw new ApiError(404, 'Meeting not found');
  if (meetingRow.status === 'cancelled') {
    throw new ApiError(400, 'Cannot deploy a cancelled meeting');
  }
  if (meetingRow.status === 'completed') {
    throw new ApiError(400, 'This meeting has already been completed');
  }
  // Checked here rather than letting the bot reject it, so the failure names the
  // thing the admin has to fix instead of surfacing as a 502 from another service.
  if (!meetingRow.meeting_url) {
    throw new ApiError(400, 'This meeting has no meeting link — add one before deploying the bot.');
  }

  const payload = await buildContextPackage(meetingRow);
  await repository.upsertContextPackage(id, payload);
  const deployment = await repository.upsertDeployment(id, payload);

  // Actually put the bot in the call, BEFORE stamping deployed_at. If the bot
  // service is down or rejects the job this throws, leaving the meeting honestly
  // un-deployed — getDeploymentStatus reads meetings.deployed_at, so the UI keeps
  // showing "Not deployed" rather than claiming a bot that never joined. The
  // frozen snapshot above is harmless to keep: it is overwritten on the retry.
  await botClient.deployBot(id, deployment.context);

  await repository.markDeployed(id, deployment.deployed_at);
  if (meetingRow.status === 'scheduled') {
    await repository.updateStatus(id, 'context_ready');
  }
  logAudit({ organizationId: meetingRow.organization_id, actorId, action: 'meeting.deploy', targetType: 'meeting', targetId: id }).catch(
    (err) => console.error('[audit] failed to log meeting.deploy:', err)
  );

  return { deployed: true, deployedAt: deployment.deployed_at, context: deployment.context };
}

function shapeResult({ ended, summary, transcript, endedAt }) {
  const transcriptText = transcript || '';
  return {
    ended,
    summary: summary || null,
    transcript: transcript || null,
    // "Who took part" is derived from the transcript's distinct speakers —
    // attendance is never reported to us (see meetings.summarizer). Empty until
    // the meeting has ended and produced a transcript.
    speakers: ended ? summarizer.extractSpeakers(transcriptText) : [],
    endedAt: endedAt || null,
  };
}

/**
 * Transcript + AI summary for a finished meeting, for the detail page.
 *
 * The external Meeting Bot produces the summary (server.py summarizes the
 * transcript when the call ends) and keeps it only in memory, so we persist a
 * copy the first time it reports the meeting ended and serve that copy from
 * then on:
 *   - If we already stored a result, return it — no bot round-trip, and it
 *     survives a bot-service restart.
 *   - Otherwise ask the bot. Until the call ends it answers {ended: false},
 *     which we pass straight through so the UI can keep polling. Once it
 *     reports ended, we summarize (falling back to our own Groq call if the bot
 *     returned only a transcript), upsert, flip the meeting to 'completed', and
 *     return the stored row.
 *
 * Always resolves (getResult on the bot client is best-effort and never
 * throws), so a detail page can render even when the bot service is down.
 */
async function getMeetingResult(id) {
  const meetingRow = await repository.findById(id);
  if (!meetingRow) throw new ApiError(404, 'Meeting not found');

  const stored = await repository.getResult(id);
  if (stored) {
    return shapeResult({
      ended: true,
      summary: stored.summary,
      transcript: stored.transcript,
      endedAt: stored.ended_at,
    });
  }

  const result = await botClient.getResult(id);
  if (!result.ended) {
    return shapeResult({ ended: false });
  }

  const transcript = result.transcript || '';
  // Prefer the bot's own summary; fall back to a Node-side Groq summary when the
  // bot returned a transcript but no summary. Both are best-effort — a null
  // summary just means the UI shows the transcript alone.
  let summary = (result.summary || '').trim();
  if (!summary && transcript.trim()) {
    summary = await summarizer.summarizeTranscript(transcript);
  }

  const saved = await repository.upsertResult(id, {
    summary: summary || null,
    transcript: transcript || null,
  });
  // The meeting is over — reflect it in status so the list and detail views read
  // 'Completed' instead of staying on 'Context ready'. Never override a
  // cancellation.
  if (meetingRow.status !== 'cancelled' && meetingRow.status !== 'completed') {
    await repository.updateStatus(id, 'completed');
  }

  return shapeResult({
    ended: true,
    summary: saved.summary,
    transcript: saved.transcript,
    endedAt: saved.ended_at,
  });
}

async function getDeploymentStatus(id) {
  const meetingRow = await repository.findById(id);
  if (!meetingRow) throw new ApiError(404, 'Meeting not found');
  const deployment = await repository.getDeployment(id);
  return {
    deployed: Boolean(meetingRow.deployed_at),
    deployedAt: meetingRow.deployed_at ?? null,
    context: deployment?.context ?? null,
  };
}

module.exports = {
  MEETING_TYPES,
  createMeeting,
  listMeetings,
  getMeetingDetail,
  updateMeeting,
  deleteMeeting,
  cancelMeeting,
  resendInvitations,
  generateContext,
  getContext,
  previewContext,
  deployMeeting,
  getDeploymentStatus,
  getMeetingResult,
};
