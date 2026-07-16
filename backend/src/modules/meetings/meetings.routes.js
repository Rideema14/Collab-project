const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./meetings.controller');

const router = express.Router();

router.use(requireAuth);
router.post('/', controller.createMeeting);
router.get('/', controller.listMeetings);
// Registered before /:meetingId so this literal segment is never mistaken
// for a meeting id.
router.post('/preview-context', controller.previewContext);
router.get('/:meetingId', validateIdParam('meetingId'), controller.getMeeting);
router.patch('/:meetingId', validateIdParam('meetingId'), controller.updateMeeting);
router.post('/:meetingId/cancel', validateIdParam('meetingId'), controller.cancelMeeting);
router.post('/:meetingId/context', validateIdParam('meetingId'), controller.generateContext);
router.get('/:meetingId/context', validateIdParam('meetingId'), controller.getContext);

module.exports = router;
