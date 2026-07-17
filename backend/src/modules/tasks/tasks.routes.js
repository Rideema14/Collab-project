const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/requirePermission');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./tasks.controller');

// Mounted at /api/projects/:projectId/tasks
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.use(requireAuth);
nestedRouter.post(
  '/',
  validateIdParam('projectId'),
  requirePermission('task.create', requirePermission.projectOrg('projectId')),
  controller.createTask
);
nestedRouter.get(
  '/',
  validateIdParam('projectId'),
  requirePermission('task.read', requirePermission.projectOrg('projectId')),
  controller.getProjectBoard
);

// Mounted at /api/tasks
const flatRouter = express.Router();
flatRouter.use(requireAuth);
flatRouter.patch(
  '/:taskId/status',
  validateIdParam('taskId'),
  requirePermission('task.edit', requirePermission.taskOrg('taskId')),
  controller.updateStatus
);
flatRouter.patch(
  '/:taskId',
  validateIdParam('taskId'),
  requirePermission('task.edit', requirePermission.taskOrg('taskId')),
  controller.updateTask
);
flatRouter.delete(
  '/:taskId',
  validateIdParam('taskId'),
  requirePermission('task.delete', requirePermission.taskOrg('taskId')),
  controller.deleteTask
);

module.exports = { nestedRouter, flatRouter };
