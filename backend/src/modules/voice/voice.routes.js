const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/requirePermission');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./voice.controller');

// Mounted at /api/projects/:projectId/tasks/voice
const router = express.Router({ mergeParams: true });

router.use(requireAuth);
router.use(validateIdParam('projectId'));

router.post(
  '/parse',
  requirePermission('task.read', requirePermission.projectOrg('projectId')),
  controller.handleUpload,
  controller.parseCommand
);
router.post(
  '/',
  requirePermission('task.create', requirePermission.projectOrg('projectId')),
  controller.handleUpload,
  controller.createFromVoice
);

module.exports = router;
