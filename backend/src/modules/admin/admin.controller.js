const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./admin.service');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await service.getDashboard(req.organizationId);
  res.json({ success: true, data });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const data = await service.getAnalytics(req.organizationId);
  res.json({ success: true, data });
});

const listUsers = asyncHandler(async (req, res) => {
  const data = await service.listUsers(req.organizationId);
  res.json({ success: true, data });
});

const changeUserRole = asyncHandler(async (req, res) => {
  const data = await service.changeUserRole(req.organizationId, req.params.userId, req.body?.role, req.user.id);
  res.json({ success: true, data });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const data = await service.setUserStatus(req.organizationId, req.params.userId, req.body?.status, req.user.id);
  res.json({ success: true, data });
});

const forceLogout = asyncHandler(async (req, res) => {
  const data = await service.forceLogout(req.organizationId, req.params.userId, req.user.id);
  res.json({ success: true, data });
});

const removeUser = asyncHandler(async (req, res) => {
  await service.removeUser(req.organizationId, req.params.userId, req.user.id);
  res.status(204).send();
});

const getAuditLog = asyncHandler(async (req, res) => {
  const data = await service.getAuditLog(req.organizationId);
  res.json({ success: true, data });
});

const getLoginHistory = asyncHandler(async (req, res) => {
  const data = await service.getLoginHistory(req.organizationId);
  res.json({ success: true, data });
});

const getSettings = asyncHandler(async (req, res) => {
  const data = await service.getSettings(req.organizationId);
  res.json({ success: true, data });
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await service.updateSettings(req.organizationId, req.body || {}, req.user.id);
  res.json({ success: true, data });
});

const bulkUpdateTaskStatus = asyncHandler(async (req, res) => {
  const data = await service.bulkUpdateTaskStatus(req.organizationId, req.body?.taskIds, req.body?.status, req.user.id);
  res.json({ success: true, data });
});

const bulkDeleteTasks = asyncHandler(async (req, res) => {
  const data = await service.bulkDeleteTasks(req.organizationId, req.body?.taskIds, req.user.id);
  res.json({ success: true, data });
});

module.exports = {
  getDashboard,
  getAnalytics,
  listUsers,
  changeUserRole,
  setUserStatus,
  forceLogout,
  removeUser,
  getAuditLog,
  getLoginHistory,
  getSettings,
  updateSettings,
  bulkUpdateTaskStatus,
  bulkDeleteTasks,
};
