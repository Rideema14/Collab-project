const { pool } = require('../../config/db');

async function create({ name, createdBy, organizationId }) {
  const { rows } = await pool.query(
    `INSERT INTO projects (name, created_by, organization_id)
     VALUES ($1, $2, $3)
     RETURNING id, name, created_by, created_at`,
    [name, createdBy, organizationId]
  );
  return rows[0];
}

async function findAll(organizationId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.archived, p.created_at,
            u.id AS created_by_id, u.name AS created_by_name
     FROM projects p
     JOIN users u ON u.id = p.created_by
     WHERE p.organization_id = $1
     ORDER BY p.created_at DESC`,
    [organizationId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, name, created_by, organization_id, archived, created_at FROM projects WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function findByIdWithCreator(id) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.archived, p.created_at,
            u.id AS created_by_id, u.name AS created_by_name
     FROM projects p
     JOIN users u ON u.id = p.created_by
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function update(id, fields) {
  const sets = [];
  const values = [];
  let i = 1;
  if (fields.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(fields.name);
  }
  if (fields.archived !== undefined) {
    sets.push(`archived = $${i++}`);
    values.push(fields.archived);
  }
  if (sets.length === 0) return findByIdWithCreator(id);
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`,
    values
  );
  if (!rows[0]) return null;
  return findByIdWithCreator(id);
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { create, findAll, findById, findByIdWithCreator, update, remove };
