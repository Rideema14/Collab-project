const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./projects.service');

const createProject = asyncHandler(async (req, res) => {
  const project = await service.createProject({
    name: req.body?.name,
    createdBy: req.user.id,
    organizationId: req.organizationId,
  });
  res.status(201).json({ success: true, data: project });
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await service.listProjects(req.organizationId);
  res.json({ success: true, data: projects });
});

const updateProject = asyncHandler(async (req, res) => {
  const { name, archived } = req.body || {};
  const project = await service.updateProject(req.params.projectId, { name, archived }, req.user.id);
  res.json({ success: true, data: project });
});

const deleteProject = asyncHandler(async (req, res) => {
  await service.deleteProject(req.params.projectId, req.user.id);
  res.status(204).send();
});

module.exports = { createProject, listProjects, updateProject, deleteProject };
