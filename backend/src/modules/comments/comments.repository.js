const { pool } = require('../../config/db');

const SELECT_COMMENT = `
  SELECT c.id, c.task_id, c.author_id, c.body, c.parent_id, c.created_at,
         u.name AS author_name, u.email AS author_email,
         COALESCE(
           (SELECT json_object_agg(emoji, user_ids)
            FROM (
              SELECT emoji, json_agg(user_id) AS user_ids
              FROM comment_reactions cr
              WHERE cr.comment_id = c.id
              GROUP BY emoji
            ) grouped),
           '{}'
         ) AS reactions
  FROM comments c
  JOIN users u ON u.id = c.author_id
`;

async function findAllByTask(taskId) {
  const { rows } = await pool.query(`${SELECT_COMMENT} WHERE c.task_id = $1 ORDER BY c.created_at ASC`, [taskId]);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_COMMENT} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

/** Also confirms the comment's task belongs to the given org — used before mutating a comment by id. */
async function findByIdWithOrg(id) {
  const { rows } = await pool.query(
    `SELECT c.id, c.author_id, p.organization_id
     FROM comments c
     JOIN tasks t ON t.id = c.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE c.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function create({ taskId, authorId, body, parentId }) {
  const { rows } = await pool.query(
    `INSERT INTO comments (task_id, author_id, body, parent_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [taskId, authorId, body, parentId ?? null]
  );
  return findById(rows[0].id);
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM comments WHERE id = $1', [id]);
  return rowCount > 0;
}

async function addReaction(commentId, userId, emoji) {
  await pool.query(
    'INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [commentId, userId, emoji]
  );
}

async function removeReaction(commentId, userId, emoji) {
  await pool.query('DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3', [
    commentId,
    userId,
    emoji,
  ]);
}

module.exports = { findAllByTask, findById, findByIdWithOrg, create, remove, addReaction, removeReaction };
