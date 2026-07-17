const { pool } = require('../config/db');

/**
 * Writes one audit_log row. Fire-and-forget by design (callers `await` it but
 * a logging failure should never fail the underlying action) — every call
 * site wraps this in `.catch(err => console.error(...))`, same convention as
 * mailer.send() call sites.
 */
async function logAudit({ organizationId, actorId, action, targetType, targetId }) {
  await pool.query(
    `INSERT INTO audit_log (organization_id, actor_id, action, target_type, target_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [organizationId ?? null, actorId ?? null, action, targetType ?? null, targetId != null ? String(targetId) : null]
  );
}

module.exports = { logAudit };
