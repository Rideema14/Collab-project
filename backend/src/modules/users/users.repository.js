const { pool } = require('../../config/db');

async function findAll() {
  const { rows } = await pool.query('SELECT id, name, email FROM users ORDER BY name ASC');
  return rows;
}

module.exports = { findAll };
