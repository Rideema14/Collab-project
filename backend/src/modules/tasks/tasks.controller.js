const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./tasks.service');

const createTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  // `status` is optional (custom status system); omit it to default to 'To Do'.
  const { title, status, assigneeId, dueDate } = req.body || {};
  const task = await service.createTask({ projectId, title, status, assigneeId, dueDate });
  res.status(201).json({ success: true, data: task });
});

const getProjectBoard = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const board = await service.getBoard(projectId);
  res.json({ success: true, data: board });
});

const updateStatus = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body || {};
  const task = await service.updateTaskStatus(taskId, status);
  res.json({ success: true, data: task });
});

const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, assigneeId, dueDate } = req.body || {};
  const task = await service.updateTask(taskId, { title, assigneeId, dueDate });
  res.json({ success: true, data: task });
});

const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  await service.deleteTask(taskId);
  res.status(204).send();
});

module.exports = { createTask, getProjectBoard, updateStatus, updateTask, deleteTask };
