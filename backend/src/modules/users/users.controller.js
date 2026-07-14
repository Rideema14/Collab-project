const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./users.service');

const listMembers = asyncHandler(async (req, res) => {
  const members = await service.listMembers();
  res.json({ success: true, data: members });
});

module.exports = { listMembers };
