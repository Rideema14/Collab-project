const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const controller = require('./ai.controller');

// Mounted at /api/ai
const router = express.Router();

router.use(requireAuth);
router.post('/command', controller.command);
router.post('/transcribe', controller.handleUpload, controller.transcribe);

module.exports = router;
