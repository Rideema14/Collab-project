const { pool } = require('../../config/db');

async function findAll(organizationId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email
     FROM users u
     JOIN memberships m ON m.user_id = u.id
     WHERE m.organization_id = $1
     ORDER BY u.name ASC`,
    [organizationId]
  );
  return rows;
}

module.exports = { findAll };
