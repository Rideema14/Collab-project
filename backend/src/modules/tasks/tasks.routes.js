const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./tasks.controller');

// Mounted at /api/projects/:projectId/tasks
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.use(requireAuth);
nestedRouter.post('/', validateIdParam('projectId'), controller.createTask);
nestedRouter.get('/', validateIdParam('projectId'), controller.getProjectBoard);

// Mounted at /api/tasks
const flatRouter = express.Router();
flatRouter.use(requireAuth);
flatRouter.patch('/:taskId/status', validateIdParam('taskId'), controller.updateStatus);
flatRouter.patch('/:taskId', validateIdParam('taskId'), controller.updateTask);
flatRouter.delete('/:taskId', validateIdParam('taskId'), controller.deleteTask);

module.exports = { nestedRouter, flatRouter };
