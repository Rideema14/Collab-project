const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../utils/auditLog');
const repository = require('./teams.repository');

function shapeTeam(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at, members: row.members };
}

async function listTeams(organizationId) {
  const rows = await repository.findAll(organizationId);
  return rows.map(shapeTeam);
}

async function createTeam({ name, organizationId, actorId }) {
  if (!name || !name.trim()) throw new ApiError(400, 'Team name is required');
  const id = await repository.create({ name: name.trim(), organizationId });
  logAudit({ organizationId, actorId, action: 'team.create', targetType: 'team', targetId: id }).catch((err) =>
    console.error('[audit] failed to log team.create:', err)
  );
  return { id, name: name.trim(), members: [] };
}

/** Throws if the team doesn't exist or belongs to a different org than expected. */
async function getOwnTeamOrThrow(teamId, organizationId) {
  const team = await repository.findById(teamId);
  if (!team || team.organization_id !== organizationId) throw new ApiError(404, 'Team not found');
  return team;
}

async function renameTeam(teamId, name, organizationId, actorId) {
  await getOwnTeamOrThrow(teamId, organizationId);
  if (!name || !name.trim()) throw new ApiError(400, 'Team name is required');
  await repository.rename(teamId, name.trim());
  logAudit({ organizationId, actorId, action: 'team.rename', targetType: 'team', targetId: teamId }).catch((err) =>
    console.error('[audit] failed to log team.rename:', err)
  );
}

async function deleteTeam(teamId, organizationId, actorId) {
  await getOwnTeamOrThrow(teamId, organizationId);
  await repository.remove(teamId);
  logAudit({ organizationId, actorId, action: 'team.delete', targetType: 'team', targetId: teamId }).catch((err) =>
    console.error('[audit] failed to log team.delete:', err)
  );
}

async function addMember(teamId, userId, organizationId, actorId) {
  await getOwnTeamOrThrow(teamId, organizationId);
  await repository.addMember(teamId, userId);
  logAudit({ organizationId, actorId, action: 'team.member.add', targetType: 'team', targetId: teamId }).catch((err) =>
    console.error('[audit] failed to log team.member.add:', err)
  );
}

async function removeMember(teamId, userId, organizationId, actorId) {
  await getOwnTeamOrThrow(teamId, organizationId);
  await repository.removeMember(teamId, userId);
  logAudit({ organizationId, actorId, action: 'team.member.remove', targetType: 'team', targetId: teamId }).catch((err) =>
    console.error('[audit] failed to log team.member.remove:', err)
  );
}

module.exports = { listTeams, createTeam, renameTeam, deleteTeam, addMember, removeMember };
