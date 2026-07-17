const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/requirePermission');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./teams.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/', requirePermission('team.read', requirePermission.ownOrg), controller.listTeams);
router.post('/', requirePermission('team.manage', requirePermission.ownOrg), controller.createTeam);
router.patch(
  '/:teamId',
  validateIdParam('teamId'),
  requirePermission('team.manage', requirePermission.ownOrg),
  controller.renameTeam
);
router.delete(
  '/:teamId',
  validateIdParam('teamId'),
  requirePermission('team.manage', requirePermission.ownOrg),
  controller.deleteTeam
);
router.post(
  '/:teamId/members',
  validateIdParam('teamId'),
  requirePermission('team.manage', requirePermission.ownOrg),
  controller.addMember
);
router.delete(
  '/:teamId/members/:userId',
  validateIdParam('teamId'),
  requirePermission('team.manage', requirePermission.ownOrg),
  controller.removeMember
);

module.exports = router;
