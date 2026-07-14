const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./projects.service');

const createProject = asyncHandler(async (req, res) => {
  const project = await service.createProject({
    name: req.body?.name,
    createdBy: req.user.id,
  });
  res.status(201).json({ success: true, data: project });
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await service.listProjects();
  res.json({ success: true, data: projects });
});

module.exports = { createProject, listProjects };
