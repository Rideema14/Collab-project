const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./meetings.service');

const createMeeting = asyncHandler(async (req, res) => {
  const { title, type, scheduledAt, meetingUrl, projectIds, participantUserIds } = req.body || {};
  const meeting = await service.createMeeting({
    title,
    type,
    scheduledAt,
    meetingUrl,
    projectIds,
    participantUserIds,
    createdBy: req.user.id,
    organizationId: req.organizationId,
  });
  res.status(201).json({ success: true, data: meeting });
});

const listMeetings = asyncHandler(async (req, res) => {
  const meetings = await service.listMeetings(req.organizationId);
  res.json({ success: true, data: meetings });
});

const getMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const meeting = await service.getMeetingDetail(meetingId);
  res.json({ success: true, data: meeting });
});

const updateMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const { title, type, scheduledAt, meetingUrl, projectIds, participantUserIds } = req.body || {};
  const meeting = await service.updateMeeting(meetingId, {
    title,
    type,
    scheduledAt,
    meetingUrl,
    projectIds,
    participantUserIds,
  });
  res.json({ success: true, data: meeting });
});

const deleteMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  await service.deleteMeeting(meetingId, req.user.id);
  res.status(204).send();
});

const cancelMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const meeting = await service.cancelMeeting(meetingId, req.user.id);
  res.json({ success: true, data: meeting });
});

const resendInvitations = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const meeting = await service.resendInvitations(meetingId, req.user.id);
  res.json({ success: true, data: meeting });
});

const generateContext = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const context = await service.generateContext(meetingId);
  res.status(201).json({ success: true, data: context });
});

const getContext = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const context = await service.getContext(meetingId);
  res.json({ success: true, data: context });
});

const previewContext = asyncHandler(async (req, res) => {
  const { projectIds, participantUserIds } = req.body || {};
  const payload = await service.previewContext({ projectIds, participantUserIds, organizationId: req.organizationId });
  res.json({ success: true, data: payload });
});

const deployMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const result = await service.deployMeeting(meetingId, req.user.id);
  res.status(201).json({ success: true, data: result });
});

const getDeployment = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const result = await service.getDeploymentStatus(meetingId);
  res.json({ success: true, data: result });
});

module.exports = {
  createMeeting,
  listMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  cancelMeeting,
  resendInvitations,
  generateContext,
  getContext,
  previewContext,
  deployMeeting,
  getDeployment,
};
