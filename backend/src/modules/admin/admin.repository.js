const { pool } = require('../../config/db');

// ---- Dashboard / Analytics ----
async function getCounts(organizationId) {
  const [members, projects, tasks] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM memberships WHERE organization_id = $1', [organizationId]),
    pool.query('SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND archived = false', [organizationId]),
    pool.query('SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.organization_id = $1', [
      organizationId,
    ]),
  ]);
  return {
    members: Number(members.rows[0].count),
    projects: Number(projects.rows[0].count),
    tasks: Number(tasks.rows[0].count),
  };
}

async function getTaskStats(organizationId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE t.status = 'Done') AS completed,
       COUNT(*) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status <> 'Done') AS overdue,
       COUNT(*) AS total
     FROM tasks t JOIN projects p ON p.id = t.project_id
     WHERE p.organization_id = $1`,
    [organizationId]
  );
  const row = rows[0];
  return { completed: Number(row.completed), overdue: Number(row.overdue), total: Number(row.total) };
}

async function getStatusBreakdown(organizationId) {
  const { rows } = await pool.query(
    `SELECT t.status, COUNT(*) AS count
     FROM tasks t JOIN projects p ON p.id = t.project_id
     WHERE p.organization_id = $1
     GROUP BY t.status
     ORDER BY count DESC`,
    [organizationId]
  );
  return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

async function getRoleBreakdown(organizationId) {
  const { rows } = await pool.query(
    'SELECT role, COUNT(*) AS count FROM memberships WHERE organization_id = $1 GROUP BY role',
    [organizationId]
  );
  return rows.map((r) => ({ role: r.role, count: Number(r.count) }));
}

// ---- Users ----
async function listMembers(organizationId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.status, m.role
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = $1
     ORDER BY u.name ASC`,
    [organizationId]
  );
  return rows;
}

async function countByRole(organizationId, role) {
  const { rows } = await pool.query('SELECT COUNT(*) FROM memberships WHERE organization_id = $1 AND role = $2', [
    organizationId,
    role,
  ]);
  return Number(rows[0].count);
}

async function getMembership(organizationId, userId) {
  const { rows } = await pool.query('SELECT role FROM memberships WHERE organization_id = $1 AND user_id = $2', [
    organizationId,
    userId,
  ]);
  return rows[0] || null;
}

async function setRole(organizationId, userId, role) {
  const { rows } = await pool.query(
    'UPDATE memberships SET role = $1 WHERE organization_id = $2 AND user_id = $3 RETURNING user_id',
    [role, organizationId, userId]
  );
  return rows[0] || null;
}

async function setUserStatus(userId, status) {
  const { rows } = await pool.query('UPDATE users SET status = $1 WHERE id = $2 RETURNING id', [status, userId]);
  return rows[0] || null;
}

async function bumpTokenVersion(userId) {
  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
}

async function removeMembership(organizationId, userId) {
  const { rowCount } = await pool.query('DELETE FROM memberships WHERE organization_id = $1 AND user_id = $2', [
    organizationId,
    userId,
  ]);
  return rowCount > 0;
}

// ---- Audit log / Login history ----
async function listAuditLog(organizationId, limit = 100) {
  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, u.id AS actor_id, u.name AS actor_name
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.organization_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [organizationId, limit]
  );
  return rows;
}

async function listLoginHistory(organizationId, limit = 100) {
  const { rows } = await pool.query(
    `SELECT le.id, le.ip, le.user_agent, le.created_at, u.id AS user_id, u.name AS user_name
     FROM login_events le
     JOIN users u ON u.id = le.user_id
     JOIN memberships m ON m.user_id = u.id AND m.organization_id = $1
     ORDER BY le.created_at DESC
     LIMIT $2`,
    [organizationId, limit]
  );
  return rows;
}

// ---- Settings ----
async function getOrganization(organizationId) {
  const { rows } = await pool.query('SELECT id, name, settings FROM organizations WHERE id = $1', [organizationId]);
  return rows[0] || null;
}

async function updateOrganization(organizationId, { name, settings }) {
  const sets = [];
  const values = [];
  let i = 1;
  if (name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(name);
  }
  if (settings !== undefined) {
    sets.push(`settings = $${i++}`);
    values.push(JSON.stringify(settings));
  }
  if (sets.length === 0) return getOrganization(organizationId);
  values.push(organizationId);
  const { rows } = await pool.query(
    `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, name, settings`,
    values
  );
  return rows[0];
}

// ---- Bulk tasks (org-scoped via the projects join — a caller can only ever
// touch task ids that actually belong to their own org, regardless of what
// ids they pass in). ----
async function bulkUpdateStatus(taskIds, status, organizationId) {
  const { rows } = await pool.query(
    `UPDATE tasks t SET status = $1, updated_at = now()
     FROM projects p
     WHERE t.project_id = p.id AND p.organization_id = $2 AND t.id = ANY($3::int[])
     RETURNING t.id`,
    [status, organizationId, taskIds]
  );
  return rows.map((r) => r.id);
}

async function bulkDelete(taskIds, organizationId) {
  const { rows } = await pool.query(
    `DELETE FROM tasks t
     USING projects p
     WHERE t.project_id = p.id AND p.organization_id = $1 AND t.id = ANY($2::int[])
     RETURNING t.id`,
    [organizationId, taskIds]
  );
  return rows.map((r) => r.id);
}

module.exports = {
  getCounts,
  getTaskStats,
  getStatusBreakdown,
  getRoleBreakdown,
  listMembers,
  countByRole,
  getMembership,
  setRole,
  setUserStatus,
  bumpTokenVersion,
  removeMembership,
  listAuditLog,
  listLoginHistory,
  getOrganization,
  updateOrganization,
  bulkUpdateStatus,
  bulkDelete,
};
