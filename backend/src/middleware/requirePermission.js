const { ApiError } = require('../utils/ApiError');
const { pool } = require('../config/db');

/** Owner > Admin > Manager > Member > Guest > Bot — see docs/ENTERPRISE_PLAN_V2.md §2c. */
const ROLE_RANK = { bot: 0, guest: 1, member: 2, manager: 3, admin: 4, owner: 5 };

/**
 * Minimum role required per action. Anything not listed defaults to 'member'
 * (the baseline "you must be a real member of this org" bar).
 */
const ACTION_MIN_ROLE = {
  'project.create': 'manager',
  'project.read': 'guest',
  'project.edit': 'manager',
  'project.archive': 'manager',
  'project.delete': 'admin',
  'task.create': 'member',
  'task.read': 'guest',
  'task.edit': 'member',
  'task.delete': 'member',
  'meeting.manage': 'admin',
  'meeting.read': 'member',
  'user.read': 'guest',
  'user.manage': 'admin',
  'team.manage': 'admin',
  'org.settings': 'admin',
  'org.delete': 'owner',
  'billing.manage': 'owner',
  'admin.access': 'admin',
};

async function findMembership(userId, organizationId) {
  const { rows } = await pool.query(
    'SELECT role FROM memberships WHERE user_id = $1 AND organization_id = $2',
    [userId, organizationId]
  );
  return rows[0]?.role ?? null;
}

/** A user's own organization. The app is single-org-per-user in practice today; first membership wins. */
async function findDefaultOrganizationId(userId) {
  const { rows } = await pool.query(
    'SELECT organization_id FROM memberships WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
    [userId]
  );
  return rows[0]?.organization_id ?? null;
}

/**
 * @param action - one of the ACTION_MIN_ROLE keys (or any 'x.read'/'x.write'-shaped string).
 * @param resolveOrgId - (req) => Promise<number|null>, the organization_id the target
 *   resource belongs to. Use `requirePermission.ownOrg` for create-type routes with no
 *   existing resource to check against yet.
 *
 * NOTE — known limitation: Guest is enforced at the ORGANIZATION level here (same as
 * every other role), not per-project. The target spec says Guests should only access
 * "specific projects" — that needs a project-membership ACL table that doesn't exist
 * yet (flagged in ENTERPRISE_PLAN_V2.md as a gap, not silently pretended away). Today
 * a Guest can read anything in their org, same as before but no longer everything in
 * the whole app.
 */
function requirePermission(action, resolveOrgId) {
  return async function permissionCheck(req, res, next) {
    try {
      const organizationId = await resolveOrgId(req);
      if (!organizationId) return next(new ApiError(404, 'Resource not found'));

      const role = await findMembership(req.user.id, organizationId);
      if (!role) return next(new ApiError(403, 'You are not a member of this organization'));

      // Bot accounts are hard-blocked from anything but reads, regardless of the action table.
      if (role === 'bot' && !action.endsWith('.read')) {
        return next(new ApiError(403, 'Bot accounts are read-only'));
      }

      const minRole = ACTION_MIN_ROLE[action] ?? 'member';
      if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
        return next(new ApiError(403, `This action requires the ${minRole} role or higher`));
      }

      req.organizationId = organizationId;
      req.membershipRole = role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** For create-type routes: resolve the organization from the caller's own membership, not a URL param. */
requirePermission.ownOrg = (req) => findDefaultOrganizationId(req.user.id);

/** Resolves organization_id from a :projectId route param. */
requirePermission.projectOrg =
  (paramName = 'projectId') =>
  async (req) => {
    const { rows } = await pool.query('SELECT organization_id FROM projects WHERE id = $1', [req.params[paramName]]);
    return rows[0]?.organization_id ?? null;
  };

/** Resolves organization_id from a :taskId route param, via the task's project. */
requirePermission.taskOrg =
  (paramName = 'taskId') =>
  async (req) => {
    const { rows } = await pool.query(
      'SELECT p.organization_id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = $1',
      [req.params[paramName]]
    );
    return rows[0]?.organization_id ?? null;
  };

/** Resolves organization_id from a :meetingId route param. */
requirePermission.meetingOrg =
  (paramName = 'meetingId') =>
  async (req) => {
    const { rows } = await pool.query('SELECT organization_id FROM meetings WHERE id = $1', [req.params[paramName]]);
    return rows[0]?.organization_id ?? null;
  };

module.exports = { requirePermission, findDefaultOrganizationId, findMembership, ROLE_RANK, ACTION_MIN_ROLE };
