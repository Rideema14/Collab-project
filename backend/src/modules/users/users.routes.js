const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const controller = require('./users.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/', controller.listMembers);

module.exports = router;
