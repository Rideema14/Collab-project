const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../utils/auditLog');
const repository = require('./comments.repository');

function shapeComment(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    body: row.body,
    parentId: row.parent_id,
    createdAt: row.created_at,
    reactions: row.reactions ?? {},
  };
}

async function listComments(taskId) {
  const rows = await repository.findAllByTask(taskId);
  return rows.map(shapeComment);
}

async function createComment({ taskId, authorId, body, parentId, organizationId }) {
  if (!body || !body.trim()) throw new ApiError(400, 'Comment body is required');
  const row = await repository.create({ taskId, authorId, body: body.trim(), parentId });
  logAudit({ organizationId, actorId: authorId, action: 'comment.create', targetType: 'task', targetId: taskId }).catch(
    (err) => console.error('[audit] failed to log comment.create:', err)
  );
  return shapeComment(row);
}

async function deleteComment(commentId, actorId) {
  const existing = await repository.findByIdWithOrg(commentId);
  if (!existing) throw new ApiError(404, 'Comment not found');
  await repository.remove(commentId);
  logAudit({
    organizationId: existing.organization_id,
    actorId,
    action: 'comment.delete',
    targetType: 'comment',
    targetId: commentId,
  }).catch((err) => console.error('[audit] failed to log comment.delete:', err));
}

async function toggleReaction(commentId, userId, emoji, add) {
  if (!emoji || !emoji.trim()) throw new ApiError(400, 'emoji is required');
  const existing = await repository.findByIdWithOrg(commentId);
  if (!existing) throw new ApiError(404, 'Comment not found');
  if (add) await repository.addReaction(commentId, userId, emoji);
  else await repository.removeReaction(commentId, userId, emoji);
  return repository.findById(commentId).then(shapeComment);
}

module.exports = { listComments, createComment, deleteComment, toggleReaction };
