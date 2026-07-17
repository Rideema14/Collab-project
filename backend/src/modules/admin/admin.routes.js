const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/requirePermission');
const { validateIdParam } = require('../../middleware/validateIdParam');
const controller = require('./admin.controller');

const router = express.Router();

router.use(requireAuth);
// Blanket gate: the entire /api/admin surface requires Admin or Owner. Individual
// routes can require MORE (Owner-only), never less.
router.use(requirePermission('admin.access', requirePermission.ownOrg));

router.get('/dashboard', controller.getDashboard);
router.get('/analytics', controller.getAnalytics);

router.get('/users', controller.listUsers);
router.patch('/users/:userId/role', validateIdParam('userId'), controller.changeUserRole);
router.patch('/users/:userId/status', validateIdParam('userId'), controller.setUserStatus);
router.post('/users/:userId/force-logout', validateIdParam('userId'), controller.forceLogout);
router.delete('/users/:userId', validateIdParam('userId'), controller.removeUser);

router.get('/audit-log', controller.getAuditLog);
router.get('/login-history', controller.getLoginHistory);

router.get('/settings', controller.getSettings);
router.patch('/settings', requirePermission('org.settings', requirePermission.ownOrg), controller.updateSettings);

router.patch('/tasks/bulk-status', controller.bulkUpdateTaskStatus);
router.post('/tasks/bulk-delete', controller.bulkDeleteTasks);

module.exports = router;
