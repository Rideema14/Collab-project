const { pool } = require('../../config/db');

const STATUSES = ['To Do', 'In Progress', 'Done'];

const SELECT_TASK = `
  SELECT t.id, t.project_id, t.title, t.status, t.due_date, t.created_at, t.updated_at,
         (t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status <> 'Done') AS is_overdue,
         u.id AS assignee_id, u.name AS assignee_name, u.email AS assignee_email
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
`;

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_TASK} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

async function findAllByProject(projectId) {
  const { rows } = await pool.query(`${SELECT_TASK} WHERE t.project_id = $1 ORDER BY t.created_at ASC`, [
    projectId,
  ]);
  return rows;
}

async function create({ projectId, title, assigneeId, dueDate }) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (project_id, title, status, assignee_id, due_date)
     VALUES ($1, $2, 'To Do', $3, $4)
     RETURNING id`,
    [projectId, title, assigneeId ?? null, dueDate ?? null]
  );
  return findById(rows[0].id);
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
    [status, id]
  );
  if (!rows[0]) return null;
  return findById(id);
}

async function update(id, fields) {
  const sets = [];
  const values = [];
  let i = 1;

  if (fields.title !== undefined) {
    sets.push(`title = $${i++}`);
    values.push(fields.title);
  }
  if (fields.assigneeId !== undefined) {
    sets.push(`assignee_id = $${i++}`);
    values.push(fields.assigneeId);
  }
  if (fields.dueDate !== undefined) {
    sets.push(`due_date = $${i++}`);
    values.push(fields.dueDate);
  }
  sets.push('updated_at = now()');

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`,
    values
  );
  if (!rows[0]) return null;
  return findById(id);
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { STATUSES, findById, findAllByProject, create, updateStatus, update, remove };
