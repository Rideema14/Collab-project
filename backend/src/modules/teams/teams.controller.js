const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./teams.service');

const listTeams = asyncHandler(async (req, res) => {
  const teams = await service.listTeams(req.organizationId);
  res.json({ success: true, data: teams });
});

const createTeam = asyncHandler(async (req, res) => {
  const team = await service.createTeam({
    name: req.body?.name,
    organizationId: req.organizationId,
    actorId: req.user.id,
  });
  res.status(201).json({ success: true, data: team });
});

const renameTeam = asyncHandler(async (req, res) => {
  await service.renameTeam(req.params.teamId, req.body?.name, req.organizationId, req.user.id);
  res.json({ success: true, data: { id: Number(req.params.teamId) } });
});

const deleteTeam = asyncHandler(async (req, res) => {
  await service.deleteTeam(req.params.teamId, req.organizationId, req.user.id);
  res.status(204).send();
});

const addMember = asyncHandler(async (req, res) => {
  await service.addMember(req.params.teamId, req.body?.userId, req.organizationId, req.user.id);
  res.status(201).json({ success: true, data: { teamId: Number(req.params.teamId), userId: req.body?.userId } });
});

const removeMember = asyncHandler(async (req, res) => {
  await service.removeMember(req.params.teamId, req.params.userId, req.organizationId, req.user.id);
  res.status(204).send();
});

module.exports = { listTeams, createTeam, renameTeam, deleteTeam, addMember, removeMember };
