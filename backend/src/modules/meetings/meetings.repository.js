const { pool } = require('../../config/db');

const SELECT_MEETING = `
  SELECT m.id, m.title, m.type, m.scheduled_at, m.meeting_url, m.status, m.organization_id, m.deployed_at, m.created_at, m.updated_at,
         u.id AS created_by_id, u.name AS created_by_name, u.email AS created_by_email
  FROM meetings m
  JOIN users u ON u.id = m.created_by
`;

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_MEETING} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

async function findAll(organizationId) {
  const { rows } = await pool.query(
    `${SELECT_MEETING} WHERE m.organization_id = $1 ORDER BY m.scheduled_at DESC`,
    [organizationId]
  );
  return rows;
}

async function create({ title, type, scheduledAt, meetingUrl, createdBy, organizationId }) {
  const { rows } = await pool.query(
    `INSERT INTO meetings (title, type, scheduled_at, meeting_url, created_by, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [title, type, scheduledAt, meetingUrl ?? null, createdBy, organizationId]
  );
  return findById(rows[0].id);
}

async function update(id, fields) {
  const sets = [];
  const values = [];
  let i = 1;

  if (fields.title !== undefined) {
    sets.push(`title = $${i++}`);
    values.push(fields.title);
  }
  if (fields.type !== undefined) {
    sets.push(`type = $${i++}`);
    values.push(fields.type);
  }
  if (fields.scheduledAt !== undefined) {
    sets.push(`scheduled_at = $${i++}`);
    values.push(fields.scheduledAt);
  }
  if (fields.meetingUrl !== undefined) {
    sets.push(`meeting_url = $${i++}`);
    values.push(fields.meetingUrl);
  }
  sets.push('updated_at = now()');

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE meetings SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`,
    values
  );
  if (!rows[0]) return null;
  return findById(id);
}

async function remove(id) {
  await pool.query('DELETE FROM meetings WHERE id = $1', [id]);
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE meetings SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
    [status, id]
  );
  if (!rows[0]) return null;
  return findById(id);
}

async function setProjects(meetingId, projectIds) {
  await pool.query('DELETE FROM meeting_projects WHERE meeting_id = $1', [meetingId]);
  if (projectIds.length === 0) return;
  const values = projectIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
  await pool.query(
    `INSERT INTO meeting_projects (meeting_id, project_id) VALUES ${values}`,
    [meetingId, ...projectIds]
  );
}

async function findProjects(meetingId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name
     FROM meeting_projects mp
     JOIN projects p ON p.id = mp.project_id
     WHERE mp.meeting_id = $1
     ORDER BY p.name ASC`,
    [meetingId]
  );
  return rows;
}

async function setParticipants(meetingId, userIds) {
  await pool.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [meetingId]);
  if (userIds.length === 0) return;
  const values = userIds.map((_, idx) => `($1, $${idx + 2}, now())`).join(', ');
  await pool.query(
    `INSERT INTO meeting_participants (meeting_id, user_id, invited_at) VALUES ${values}`,
    [meetingId, ...userIds]
  );
}

// LEFT JOIN LATERAL picks each recipient's most recent email_logs row (by
// created_at) so a resend's fresh attempt always wins over stale history,
// while participants with no send attempt yet (pre-migration rows, or a
// participant added between insert and the send step) fall back to nulls.
async function findParticipants(meetingId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, mp.invite_status, mp.invited_at,
            el.status AS email_status, el.error_message AS email_error,
            el.sent_at AS email_sent_at, el.delivered_at AS email_delivered_at
     FROM meeting_participants mp
     JOIN users u ON u.id = mp.user_id
     LEFT JOIN LATERAL (
       SELECT status, error_message, sent_at, delivered_at
       FROM email_logs
       WHERE meeting_id = mp.meeting_id AND recipient_email = u.email
       ORDER BY created_at DESC
       LIMIT 1
     ) el ON true
     WHERE mp.meeting_id = $1
     ORDER BY u.name ASC`,
    [meetingId]
  );
  return rows;
}

/**
 * Same shape as findProjects/findParticipants, but by raw id list rather than
 * a meeting_id join — used to preview context for a meeting that hasn't been
 * created yet (see meetings.service.js previewContext).
 */
// organizationId-scoped: an id from another org is silently dropped, not just
// unauthorized — this is what closes the "arbitrary projectIds/participantUserIds
// from anyone else's org" gap (see docs/ENTERPRISE_AUDIT.md §8).
async function findProjectsByIds(projectIds, organizationId) {
  if (projectIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id, name FROM projects WHERE id = ANY($1::int[]) AND organization_id = $2 ORDER BY name ASC`,
    [projectIds, organizationId]
  );
  return rows;
}

async function findUsersByIds(userIds, organizationId) {
  if (userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email
     FROM users u
     JOIN memberships m ON m.user_id = u.id AND m.organization_id = $2
     WHERE u.id = ANY($1::int[])
     ORDER BY u.name ASC`,
    [userIds, organizationId]
  );
  return rows;
}

/**
 * Every task currently assigned to `userId` within `projectIds`. This is a
 * *current-state* snapshot only — there is no status-history ledger to scope
 * it to a time window (see meetings.service.js buildParticipantSection).
 */
async function findTasksForAssignee(userId, projectIds) {
  if (projectIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT t.id, t.project_id, p.name AS project_name, t.title, t.status, t.due_date,
            (t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status <> 'Done') AS is_overdue
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.assignee_id = $1 AND t.project_id = ANY($2::int[])
     ORDER BY t.due_date ASC NULLS LAST`,
    [userId, projectIds]
  );
  return rows;
}

async function getContextPackage(meetingId) {
  const { rows } = await pool.query(
    `SELECT meeting_id, generated_at, payload FROM meeting_context_packages WHERE meeting_id = $1`,
    [meetingId]
  );
  return rows[0] || null;
}

async function upsertContextPackage(meetingId, payload) {
  const { rows } = await pool.query(
    `INSERT INTO meeting_context_packages (meeting_id, payload, generated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (meeting_id) DO UPDATE SET payload = $2, generated_at = now()
     RETURNING meeting_id, generated_at, payload`,
    [meetingId, JSON.stringify(payload)]
  );
  return rows[0];
}

async function upsertDeployment(meetingId, context) {
  const { rows } = await pool.query(
    `INSERT INTO meeting_deployments (meeting_id, context, deployed_at)
     VALUES ($1, $2, now())
     ON CONFLICT (meeting_id) DO UPDATE SET context = $2, deployed_at = now()
     RETURNING meeting_id, deployed_at, context`,
    [meetingId, JSON.stringify(context)]
  );
  return rows[0];
}

async function markDeployed(meetingId, deployedAt) {
  await pool.query('UPDATE meetings SET deployed_at = $1 WHERE id = $2', [deployedAt, meetingId]);
}

async function getDeployment(meetingId) {
  const { rows } = await pool.query(
    'SELECT meeting_id, deployed_at, context FROM meeting_deployments WHERE meeting_id = $1',
    [meetingId]
  );
  return rows[0] || null;
}

async function getResult(meetingId) {
  const { rows } = await pool.query(
    'SELECT meeting_id, summary, transcript, ended_at FROM meeting_results WHERE meeting_id = $1',
    [meetingId]
  );
  return rows[0] || null;
}

async function upsertResult(meetingId, { summary, transcript }) {
  const { rows } = await pool.query(
    `INSERT INTO meeting_results (meeting_id, summary, transcript, ended_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (meeting_id) DO UPDATE SET summary = $2, transcript = $3, ended_at = now()
     RETURNING meeting_id, summary, transcript, ended_at`,
    [meetingId, summary ?? null, transcript ?? null]
  );
  return rows[0];
}

async function createEmailLog({ meetingId, recipientEmail, subject, provider }) {
  const { rows } = await pool.query(
    `INSERT INTO email_logs (meeting_id, recipient_email, subject, provider, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, meeting_id, recipient_email, subject, provider, status, error_message, sent_at, delivered_at, created_at`,
    [meetingId, recipientEmail, subject, provider]
  );
  return rows[0];
}

async function updateEmailLog(id, { status, errorMessage, sentAt, deliveredAt }) {
  const sets = [];
  const values = [];
  let i = 1;

  if (status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(status);
  }
  if (errorMessage !== undefined) {
    sets.push(`error_message = $${i++}`);
    values.push(errorMessage);
  }
  if (sentAt !== undefined) {
    sets.push(`sent_at = $${i++}`);
    values.push(sentAt);
  }
  if (deliveredAt !== undefined) {
    sets.push(`delivered_at = $${i++}`);
    values.push(deliveredAt);
  }

  values.push(id);
  await pool.query(`UPDATE email_logs SET ${sets.join(', ')} WHERE id = $${i}`, values);
}

async function setParticipantInviteStatus(meetingId, recipientEmail, status) {
  await pool.query(
    `UPDATE meeting_participants SET invite_status = $1
     WHERE meeting_id = $2 AND user_id = (SELECT id FROM users WHERE email = $3)`,
    [status, meetingId, recipientEmail]
  );
}

module.exports = {
  findById,
  findAll,
  create,
  update,
  remove,
  updateStatus,
  setProjects,
  findProjects,
  findProjectsByIds,
  setParticipants,
  findParticipants,
  findUsersByIds,
  findTasksForAssignee,
  getContextPackage,
  upsertContextPackage,
  upsertDeployment,
  markDeployed,
  getDeployment,
  getResult,
  upsertResult,
  createEmailLog,
  updateEmailLog,
  setParticipantInviteStatus,
};
