const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../utils/auditLog');
const { ROLE_RANK } = require('../../middleware/requirePermission');
const repository = require('./admin.repository');

const VALID_ROLES = Object.keys(ROLE_RANK);
const VALID_STATUSES = ['active', 'suspended'];

async function getDashboard(organizationId) {
  const [counts, taskStats, roleBreakdown, recentAudit] = await Promise.all([
    repository.getCounts(organizationId),
    repository.getTaskStats(organizationId),
    repository.getRoleBreakdown(organizationId),
    repository.listAuditLog(organizationId, 5),
  ]);
  return {
    counts,
    taskStats,
    roleBreakdown,
    recentAudit: recentAudit.map(shapeAuditEntry),
  };
}

async function getAnalytics(organizationId) {
  const [taskStats, statusBreakdown] = await Promise.all([
    repository.getTaskStats(organizationId),
    repository.getStatusBreakdown(organizationId),
  ]);
  const completionRate = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
  return { ...taskStats, completionRate, statusBreakdown };
}

async function listUsers(organizationId) {
  return repository.listMembers(organizationId);
}

/** Refuses to change/remove the ONLY owner an org has — every org needs at least one. */
async function assertNotLastOwner(organizationId, userId, actionLabel) {
  const membership = await repository.getMembership(organizationId, userId);
  if (membership?.role === 'owner') {
    const ownerCount = await repository.countByRole(organizationId, 'owner');
    if (ownerCount <= 1) {
      throw new ApiError(400, `Can't ${actionLabel} the only owner — promote someone else to owner first`);
    }
  }
}

async function changeUserRole(organizationId, userId, role, actorId) {
  if (!VALID_ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of: ${VALID_ROLES.join(', ')}`);
  }
  if (role !== 'owner') {
    await assertNotLastOwner(organizationId, userId, 'change the role of');
  }
  const updated = await repository.setRole(organizationId, userId, role);
  if (!updated) throw new ApiError(404, 'That user is not a member of this organization');
  logAudit({ organizationId, actorId, action: `user.role → ${role}`, targetType: 'user', targetId: userId }).catch((err) =>
    console.error('[audit] failed to log user.role:', err)
  );
  return { userId: Number(userId), role };
}

async function setUserStatus(organizationId, userId, status, actorId) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (status === 'suspended') {
    await assertNotLastOwner(organizationId, userId, 'suspend');
  }
  const updated = await repository.setUserStatus(userId, status);
  if (!updated) throw new ApiError(404, 'User not found');
  logAudit({
    organizationId,
    actorId,
    action: status === 'suspended' ? 'user.suspend' : 'user.activate',
    targetType: 'user',
    targetId: userId,
  }).catch((err) => console.error('[audit] failed to log user.status:', err));
  return { userId: Number(userId), status };
}

async function forceLogout(organizationId, userId, actorId) {
  const membership = await repository.getMembership(organizationId, userId);
  if (!membership) throw new ApiError(404, 'That user is not a member of this organization');
  await repository.bumpTokenVersion(userId);
  logAudit({ organizationId, actorId, action: 'user.force_logout', targetType: 'user', targetId: userId }).catch((err) =>
    console.error('[audit] failed to log user.force_logout:', err)
  );
  return { userId: Number(userId) };
}

async function removeUser(organizationId, userId, actorId) {
  await assertNotLastOwner(organizationId, userId, 'remove');
  const removed = await repository.removeMembership(organizationId, userId);
  if (!removed) throw new ApiError(404, 'That user is not a member of this organization');
  logAudit({ organizationId, actorId, action: 'user.remove', targetType: 'user', targetId: userId }).catch((err) =>
    console.error('[audit] failed to log user.remove:', err)
  );
}

function shapeAuditEntry(row) {
  return {
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    actor: row.actor_id ? { id: row.actor_id, name: row.actor_name } : null,
    at: row.created_at,
  };
}

async function getAuditLog(organizationId) {
  const rows = await repository.listAuditLog(organizationId, 200);
  return rows.map(shapeAuditEntry);
}

async function getLoginHistory(organizationId) {
  const rows = await repository.listLoginHistory(organizationId, 200);
  return rows.map((row) => ({
    id: row.id,
    ip: row.ip,
    userAgent: row.user_agent,
    at: row.created_at,
    user: { id: row.user_id, name: row.user_name },
  }));
}

async function getSettings(organizationId) {
  const org = await repository.getOrganization(organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  return { id: org.id, name: org.name, settings: org.settings };
}

async function updateSettings(organizationId, { name, settings }, actorId) {
  if (name !== undefined && !name.trim()) throw new ApiError(400, 'Organization name cannot be empty');
  const org = await repository.updateOrganization(organizationId, { name: name?.trim(), settings });
  logAudit({ organizationId, actorId, action: 'org.settings.update', targetType: 'organization', targetId: organizationId }).catch(
    (err) => console.error('[audit] failed to log org.settings.update:', err)
  );
  return { id: org.id, name: org.name, settings: org.settings };
}

async function bulkUpdateTaskStatus(organizationId, taskIds, status, actorId) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) throw new ApiError(400, 'taskIds must be a non-empty array');
  if (!status || !status.trim()) throw new ApiError(400, 'status is required');
  const updated = await repository.bulkUpdateStatus(taskIds, status.trim(), organizationId);
  logAudit({
    organizationId,
    actorId,
    action: `task.bulk_status → ${status.trim()}`,
    targetType: 'task',
    targetId: updated.join(','),
  }).catch((err) => console.error('[audit] failed to log task.bulk_status:', err));
  return { updated };
}

async function bulkDeleteTasks(organizationId, taskIds, actorId) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) throw new ApiError(400, 'taskIds must be a non-empty array');
  const deleted = await repository.bulkDelete(taskIds, organizationId);
  logAudit({ organizationId, actorId, action: 'task.bulk_delete', targetType: 'task', targetId: deleted.join(',') }).catch(
    (err) => console.error('[audit] failed to log task.bulk_delete:', err)
  );
  return { deleted };
}

module.exports = {
  getDashboard,
  getAnalytics,
  listUsers,
  changeUserRole,
  setUserStatus,
  forceLogout,
  removeUser,
  getAuditLog,
  getLoginHistory,
  getSettings,
  updateSettings,
  bulkUpdateTaskStatus,
  bulkDeleteTasks,
};
