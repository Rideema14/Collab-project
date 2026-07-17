const { asyncHandler } = require('../../middleware/asyncHandler');
const service = require('./comments.service');

const listComments = asyncHandler(async (req, res) => {
  const comments = await service.listComments(req.params.taskId);
  res.json({ success: true, data: comments });
});

const createComment = asyncHandler(async (req, res) => {
  const comment = await service.createComment({
    taskId: req.params.taskId,
    authorId: req.user.id,
    body: req.body?.body,
    parentId: req.body?.parentId ?? null,
    organizationId: req.organizationId,
  });
  res.status(201).json({ success: true, data: comment });
});

const deleteComment = asyncHandler(async (req, res) => {
  await service.deleteComment(req.params.commentId, req.user.id);
  res.status(204).send();
});

const addReaction = asyncHandler(async (req, res) => {
  const comment = await service.toggleReaction(req.params.commentId, req.user.id, req.body?.emoji, true);
  res.json({ success: true, data: comment });
});

const removeReaction = asyncHandler(async (req, res) => {
  const comment = await service.toggleReaction(req.params.commentId, req.user.id, req.params.emoji, false);
  res.json({ success: true, data: comment });
});

module.exports = { listComments, createComment, deleteComment, addReaction, removeReaction };
