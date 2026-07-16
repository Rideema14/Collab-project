const { ApiError } = require('../../utils/ApiError');
const repository = require('./meetings.repository');
const mailer = require('../../utils/email');

const MEETING_TYPES = ['Daily Standup', 'Weekly Review', 'Sprint Review', 'Custom'];

// This backend has no status-history ledger, no comments table, and no task
// dependency table (see docs/MEETING_BOT_ARCHITECTURE.md, Phase 0). A context
// package generated here is therefore a *current-state snapshot*, not a
// time-windowed diff — it cannot say what changed "since the last meeting".
// Every generated package carries this list so nothing is silently implied.
const CONTEXT_LIMITATIONS = [
  "Status-change history isn't tracked yet, so this reflects each participant's current task state only — not what changed since the last meeting.",
  'Comments are stored in the browser only today and are not included.',
  'Task blocking/dependencies are not tracked on the backend and are not included.',
];

function shapeMeeting(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    scheduledAt: row.scheduled_at,
    meetingUrl: row.meeting_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: { id: row.created_by_id, name: row.created_by_name, email: row.created_by_email },
  };
}

function shapeParticipant(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    inviteStatus: row.invite_status,
    invitedAt: row.invited_at,
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
function validateMeetingUrl(value) {
  if (value === undefined || value === null || value === '') return null;
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

async function sendInviteEmails(meetingRow, participants) {
  const when = new Date(meetingRow.scheduled_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const linkLine = meetingRow.meeting_url ? `\nJoin: ${meetingRow.meeting_url}` : '';
  await Promise.all(
    participants.map((p) =>
      mailer
        .send({
          to: p.email,
          subject: `Meeting invite: ${meetingRow.title}`,
          body: `You've been invited to "${meetingRow.title}" (${meetingRow.type}) on ${when}.${linkLine}`,
        })
        .catch((err) => console.error(`[meetings] failed to send invite to ${p.email}:`, err))
    )
  );
}

async function sendCancellationEmails(meetingRow, participants) {
  await Promise.all(
    participants.map((p) =>
      mailer
        .send({
          to: p.email,
          subject: `Meeting cancelled: ${meetingRow.title}`,
          body: `"${meetingRow.title}" has been cancelled.`,
        })
        .catch((err) => console.error(`[meetings] failed to send cancellation to ${p.email}:`, err))
    )
  );
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
      const activeTasks = tasks.filter((t) => t.status !== 'Done' && !t.isOverdue);
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
    overdueTasks: participantSections.flatMap((s) => withAssignee(s.overdueTasks, s)),
    deadlines: participantSections.flatMap((s) => withAssignee(s.upcomingDeadlines, s)),
  };
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

  return {
    schemaVersion: 2,
    meetingId: meetingRow.id,
    generatedAt: new Date().toISOString(),
    meeting: shapeMeeting(meetingRow),
    participants: participants.map(shapeParticipant),
    projects: projects.map((pr) => ({ id: pr.id, name: pr.name })),
    limitations: CONTEXT_LIMITATIONS,
    ...flattenSections(participantSections),
  };
}

/**
 * Same computation as buildContextPackage, but for a meeting that doesn't
 * exist yet — used to preview each invitee's task breakdown live while an
 * admin is still picking projects/participants on the schedule form.
 */
async function previewContext({ projectIds, participantUserIds }) {
  const cleanProjectIds = validateIdArray(projectIds, 'projectIds');
  const cleanParticipantIds = validateIdArray(participantUserIds, 'participantUserIds');

  const [projects, participants] = await Promise.all([
    repository.findProjectsByIds(cleanProjectIds),
    repository.findUsersByIds(cleanParticipantIds),
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

async function createMeeting({ title, type, scheduledAt, meetingUrl, projectIds, participantUserIds, createdBy }) {
  if (!title || !title.trim()) {
    throw new ApiError(400, 'Meeting title is required');
  }
  const cleanType = validateType(type);
  const cleanScheduledAt = validateScheduledAt(scheduledAt);
  const cleanMeetingUrl = validateMeetingUrl(meetingUrl);
  const cleanProjectIds = validateIdArray(projectIds, 'projectIds');
  const cleanParticipantIds = validateIdArray(participantUserIds, 'participantUserIds');

  const meetingRow = await repository.create({
    title: title.trim(),
    type: cleanType,
    scheduledAt: cleanScheduledAt,
    meetingUrl: cleanMeetingUrl,
    createdBy,
  });
  await repository.setProjects(meetingRow.id, cleanProjectIds);
  await repository.setParticipants(meetingRow.id, cleanParticipantIds);

  const participants = await repository.findParticipants(meetingRow.id);
  await sendInviteEmails(meetingRow, participants);

  return getMeetingDetail(meetingRow.id);
}

async function listMeetings() {
  const rows = await repository.findAll();
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
    updates.meetingUrl = validateMeetingUrl(fields.meetingUrl);
  }

  if (fields.projectIds !== undefined) {
    const cleanProjectIds = validateIdArray(fields.projectIds, 'projectIds');
    await repository.setProjects(id, cleanProjectIds);
  }

  // Only email participants who are newly added by this edit — re-inviting
  // everyone on every edit would be noisy for people already on the list.
  let newlyAdded = [];
  if (fields.participantUserIds !== undefined) {
    const before = new Set((await repository.findParticipants(id)).map((p) => p.id));
    const cleanParticipantIds = validateIdArray(fields.participantUserIds, 'participantUserIds');
    await repository.setParticipants(id, cleanParticipantIds);
    newlyAdded = cleanParticipantIds.filter((pid) => !before.has(pid));
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

async function cancelMeeting(id) {
  const existing = await repository.findById(id);
  if (!existing) throw new ApiError(404, 'Meeting not found');
  if (existing.status === 'cancelled') return getMeetingDetail(id);

  await repository.updateStatus(id, 'cancelled');
  const participants = await repository.findParticipants(id);
  await sendCancellationEmails(existing, participants);

  return getMeetingDetail(id);
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

module.exports = {
  MEETING_TYPES,
  createMeeting,
  listMeetings,
  getMeetingDetail,
  updateMeeting,
  cancelMeeting,
  generateContext,
  getContext,
  previewContext,
};
