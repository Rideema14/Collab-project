const { pool } = require('../../config/db');

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash, status, token_version FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, passwordHash]
  );
  return rows[0];
}

/**
 * The org a brand-new registrant auto-joins. Single-org app today (the earliest
 * one, i.e. the backfilled "Default Organization") — once invite-to-a-specific-org
 * exists this auto-join goes away in favor of an explicit invite token.
 */
async function findDefaultOrganizationId() {
  const { rows } = await pool.query('SELECT id FROM organizations ORDER BY id ASC LIMIT 1');
  return rows[0]?.id ?? null;
}

async function addMembership(userId, organizationId, role) {
  await pool.query(
    `INSERT INTO memberships (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [organizationId, userId, role]
  );
}

async function findAuthStateById(id) {
  const { rows } = await pool.query('SELECT status, token_version FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function recordLogin(userId, { ip, userAgent }) {
  await pool.query('INSERT INTO login_events (user_id, ip, user_agent) VALUES ($1, $2, $3)', [
    userId,
    ip ?? null,
    userAgent ?? null,
  ]);
}

module.exports = { findByEmail, createUser, findDefaultOrganizationId, addMembership, recordLogin, findAuthStateById };
