const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./auth.service');

const register = asyncHandler(async (req, res) => {
  const result = await service.register(req.body || {});
  res.status(201).json({ success: true, data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body || {});
  res.status(200).json({ success: true, data: result });
});

module.exports = { register, login };
