const { pool } = require('../../config/db');

async function findAll(organizationId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.created_at,
            COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email))
                     FILTER (WHERE u.id IS NOT NULL), '[]') AS members
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     LEFT JOIN users u ON u.id = tm.user_id
     WHERE t.organization_id = $1
     GROUP BY t.id
     ORDER BY t.created_at ASC`,
    [organizationId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT id, organization_id, name FROM teams WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name, organizationId }) {
  const { rows } = await pool.query(
    'INSERT INTO teams (organization_id, name) VALUES ($1, $2) RETURNING id',
    [organizationId, name]
  );
  return rows[0].id;
}

async function rename(id, name) {
  const { rows } = await pool.query('UPDATE teams SET name = $1 WHERE id = $2 RETURNING id', [name, id]);
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM teams WHERE id = $1', [id]);
  return rowCount > 0;
}

async function addMember(teamId, userId) {
  await pool.query(
    'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [teamId, userId]
  );
}

async function removeMember(teamId, userId) {
  await pool.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
}

module.exports = { findAll, findById, create, rename, remove, addMember, removeMember };
