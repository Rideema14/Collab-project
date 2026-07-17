const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/requirePermission');
const controller = require('./users.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/', requirePermission('user.read', requirePermission.ownOrg), controller.listMembers);

module.exports = router;
