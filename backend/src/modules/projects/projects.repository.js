const { pool } = require('../../config/db');

async function create({ name, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO projects (name, created_by)
     VALUES ($1, $2)
     RETURNING id, name, created_by, created_at`,
    [name, createdBy]
  );
  return rows[0];
}

async function findAll() {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.created_at,
            u.id AS created_by_id, u.name AS created_by_name
     FROM projects p
     JOIN users u ON u.id = p.created_by
     ORDER BY p.created_at DESC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, name, created_by, created_at FROM projects WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

module.exports = { create, findAll, findById };
