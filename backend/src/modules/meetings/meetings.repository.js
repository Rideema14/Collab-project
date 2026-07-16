const { pool } = require('../../config/db');

const SELECT_MEETING = `
  SELECT m.id, m.title, m.type, m.scheduled_at, m.meeting_url, m.status, m.created_at, m.updated_at,
         u.id AS created_by_id, u.name AS created_by_name, u.email AS created_by_email
  FROM meetings m
  JOIN users u ON u.id = m.created_by
`;

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_MEETING} WHERE m.id = $1`, [id]);
  return rows[0] || null;
}

async function findAll() {
  const { rows } = await pool.query(`${SELECT_MEETING} ORDER BY m.scheduled_at DESC`);
  return rows;
}

async function create({ title, type, scheduledAt, meetingUrl, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO meetings (title, type, scheduled_at, meeting_url, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [title, type, scheduledAt, meetingUrl ?? null, createdBy]
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

async function findParticipants(meetingId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, mp.invite_status, mp.invited_at
     FROM meeting_participants mp
     JOIN users u ON u.id = mp.user_id
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
async function findProjectsByIds(projectIds) {
  if (projectIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id, name FROM projects WHERE id = ANY($1::int[]) ORDER BY name ASC`,
    [projectIds]
  );
  return rows;
}

async function findUsersByIds(userIds) {
  if (userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id, name, email FROM users WHERE id = ANY($1::int[]) ORDER BY name ASC`,
    [userIds]
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

module.exports = {
  findById,
  findAll,
  create,
  update,
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
};
