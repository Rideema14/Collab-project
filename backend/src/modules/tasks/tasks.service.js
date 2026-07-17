const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../utils/auditLog');
const repository = require('./tasks.repository');
const projectsService = require('../projects/projects.service');

function shapeTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    dueDate: row.due_date,
    isOverdue: row.is_overdue,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignee: row.assignee_id
      ? { id: row.assignee_id, name: row.assignee_name, email: row.assignee_email }
      : null,
    createdBy: row.creator_id ? { id: row.creator_id, name: row.creator_name, email: row.creator_email } : null,
  };
}

// Empty string means "clear this field" from the client's point of view;
// normalize it to null before it ever reaches SQL.
function blankToNull(value) {
  return value === '' ? null : value;
}

// v2: statuses are now free-form (custom status system). A status is any non-empty
// string up to 60 chars — matching the widened tasks.status VARCHAR(60) column.
const MAX_STATUS_LEN = 60;
function validateStatus(status) {
  if (typeof status !== 'string' || !status.trim()) {
    throw new ApiError(400, 'Status is required');
  }
  const trimmed = status.trim();
  if (trimmed.length > MAX_STATUS_LEN) {
    throw new ApiError(400, `Status must be ${MAX_STATUS_LEN} characters or fewer`);
  }
  return trimmed;
}

async function createTask({ projectId, title, status, assigneeId, dueDate, createdBy, organizationId }) {
  await projectsService.getProjectOrThrow(projectId);

  if (!title || !title.trim()) {
    throw new ApiError(400, 'Task title is required');
  }

  const row = await repository.create({
    projectId,
    title: title.trim(),
    // Optional. When absent the column default ('To Do') applies.
    status: status === undefined || status === null || status === '' ? null : validateStatus(status),
    assigneeId: blankToNull(assigneeId),
    dueDate: blankToNull(dueDate),
    createdBy: createdBy ?? null,
  });
  logAudit({ organizationId, actorId: createdBy, action: 'task.create', targetType: 'task', targetId: row.id }).catch((err) =>
    console.error('[audit] failed to log task.create:', err)
  );
  return shapeTask(row);
}

/**
 * Returns every task for a project grouped by status.
 *
 * Statuses are dynamic now, so columns are built from the data. The three legacy
 * keys ('To Do', 'In Progress', 'Done') are ALWAYS present (even when empty) so
 * older clients that read exactly those keys keep working unchanged; any custom
 * status simply appears as an additional key that legacy clients ignore.
 */
async function getBoard(projectId) {
  await projectsService.getProjectOrThrow(projectId);

  const rows = await repository.findAllByProject(projectId);
  const board = { 'To Do': [], 'In Progress': [], Done: [] };
  for (const row of rows) {
    (board[row.status] ??= []).push(shapeTask(row));
  }
  return board;
}

async function updateTaskStatus(taskId, status) {
  const clean = validateStatus(status);
  const row = await repository.updateStatus(taskId, clean);
  if (!row) throw new ApiError(404, 'Task not found');
  return shapeTask(row);
}

async function updateTask(taskId, fields) {
  const updates = {};

  if (fields.title !== undefined) {
    if (!fields.title.trim()) throw new ApiError(400, 'Task title cannot be empty');
    updates.title = fields.title.trim();
  }
  if (fields.assigneeId !== undefined) {
    updates.assigneeId = blankToNull(fields.assigneeId);
  }
  if (fields.dueDate !== undefined) {
    updates.dueDate = blankToNull(fields.dueDate);
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields provided to update');
  }

  const row = await repository.update(taskId, updates);
  if (!row) throw new ApiError(404, 'Task not found');
  return shapeTask(row);
}

async function deleteTask(taskId, { actorId, organizationId } = {}) {
  const deleted = await repository.remove(taskId);
  if (!deleted) throw new ApiError(404, 'Task not found');
  logAudit({ organizationId, actorId, action: 'task.delete', targetType: 'task', targetId: taskId }).catch((err) =>
    console.error('[audit] failed to log task.delete:', err)
  );
}

/**
 * Every overdue, non-Done task with an assignee, grouped by that assignee.
 * Used by the overdue-reminder email job — not exposed as an HTTP route.
 */
async function getOverdueTasksByAssignee() {
  const rows = await repository.findOverdueWithAssignee();
  const byAssignee = new Map();
  for (const row of rows) {
    const key = row.assignee_id;
    if (!byAssignee.has(key)) {
      byAssignee.set(key, {
        assignee: { id: row.assignee_id, name: row.assignee_name, email: row.assignee_email },
        tasks: [],
      });
    }
    byAssignee.get(key).tasks.push({ id: row.id, title: row.title, dueDate: row.due_date, projectName: row.project_name });
  }
  return [...byAssignee.values()];
}

module.exports = { createTask, getBoard, updateTaskStatus, updateTask, deleteTask, getOverdueTasksByAssignee };
