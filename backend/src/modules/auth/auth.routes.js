const express = require('express');
const controller = require('./auth.controller');

// Public routes — no auth required (these are how a token is obtained in the first place)
const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);

module.exports = router;
