const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/requirePermission');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./meetings.controller');

const router = express.Router();

router.use(requireAuth);
router.post('/', requirePermission('meeting.manage', requirePermission.ownOrg), controller.createMeeting);
router.get('/', requirePermission('meeting.read', requirePermission.ownOrg), controller.listMeetings);
// Registered before /:meetingId so this literal segment is never mistaken
// for a meeting id.
router.post('/preview-context', requirePermission('meeting.manage', requirePermission.ownOrg), controller.previewContext);
router.get(
  '/:meetingId',
  validateIdParam('meetingId'),
  requirePermission('meeting.read', requirePermission.meetingOrg('meetingId')),
  controller.getMeeting
);
router.patch(
  '/:meetingId',
  validateIdParam('meetingId'),
  requirePermission('meeting.manage', requirePermission.meetingOrg('meetingId')),
  controller.updateMeeting
);
router.delete(
  '/:meetingId',
  validateIdParam('meetingId'),
  requirePermission('meeting.manage', requirePermission.meetingOrg('meetingId')),
  controller.deleteMeeting
);
router.post(
  '/:meetingId/cancel',
  validateIdParam('meetingId'),
  requirePermission('meeting.manage', requirePermission.meetingOrg('meetingId')),
  controller.cancelMeeting
);
router.post(
  '/:meetingId/resend-invitations',
  validateIdParam('meetingId'),
  requirePermission('meeting.manage', requirePermission.meetingOrg('meetingId')),
  controller.resendInvitations
);
router.post(
  '/:meetingId/context',
  validateIdParam('meetingId'),
  requirePermission('meeting.manage', requirePermission.meetingOrg('meetingId')),
  controller.generateContext
);
router.get(
  '/:meetingId/context',
  validateIdParam('meetingId'),
  requirePermission('meeting.read', requirePermission.meetingOrg('meetingId')),
  controller.getContext
);
router.post(
  '/:meetingId/deploy',
  validateIdParam('meetingId'),
  requirePermission('meeting.manage', requirePermission.meetingOrg('meetingId')),
  controller.deployMeeting
);
router.get(
  '/:meetingId/deploy',
  validateIdParam('meetingId'),
  requirePermission('meeting.read', requirePermission.meetingOrg('meetingId')),
  controller.getDeployment
);
router.get(
  '/:meetingId/result',
  validateIdParam('meetingId'),
  requirePermission('meeting.read', requirePermission.meetingOrg('meetingId')),
  controller.getResult
);

module.exports = router;
