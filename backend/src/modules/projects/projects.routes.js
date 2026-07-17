const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/requirePermission');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./projects.controller');

const router = express.Router();

router.use(requireAuth);
router.post('/', requirePermission('project.create', requirePermission.ownOrg), controller.createProject);
router.get('/', requirePermission('project.read', requirePermission.ownOrg), controller.listProjects);
router.patch(
  '/:projectId',
  validateIdParam('projectId'),
  requirePermission('project.edit', requirePermission.projectOrg('projectId')),
  controller.updateProject
);
router.delete(
  '/:projectId',
  validateIdParam('projectId'),
  requirePermission('project.delete', requirePermission.projectOrg('projectId')),
  controller.deleteProject
);

module.exports = router;
