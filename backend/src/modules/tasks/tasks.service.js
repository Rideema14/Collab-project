const { ApiError } = require('../../utils/ApiError');
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
  };
}

// Empty string means "clear this field" from the client's point of view;
// normalize it to null before it ever reaches SQL.
function blankToNull(value) {
  return value === '' ? null : value;
}

async function createTask({ projectId, title, assigneeId, dueDate }) {
  await projectsService.getProjectOrThrow(projectId);

  if (!title || !title.trim()) {
    throw new ApiError(400, 'Task title is required');
  }

  const row = await repository.create({
    projectId,
    title: title.trim(),
    assigneeId: blankToNull(assigneeId),
    dueDate: blankToNull(dueDate),
  });
  return shapeTask(row);
}

/**
 * Returns every task for a project pre-grouped into the three fixed columns,
 * exactly what the board screen renders.
 */
async function getBoard(projectId) {
  await projectsService.getProjectOrThrow(projectId);

  const rows = await repository.findAllByProject(projectId);
  const board = { 'To Do': [], 'In Progress': [], Done: [] };
  for (const row of rows) {
    board[row.status].push(shapeTask(row));
  }
  return board;
}

async function updateTaskStatus(taskId, status) {
  if (!repository.STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${repository.STATUSES.join(', ')}`);
  }
  const row = await repository.updateStatus(taskId, status);
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

async function deleteTask(taskId) {
  const deleted = await repository.remove(taskId);
  if (!deleted) throw new ApiError(404, 'Task not found');
}

module.exports = { createTask, getBoard, updateTaskStatus, updateTask, deleteTask };
