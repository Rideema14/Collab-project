const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const controller = require('./projects.controller');

const router = express.Router();

router.use(requireAuth);
router.post('/', controller.createProject);
router.get('/', controller.listProjects);

module.exports = router;
