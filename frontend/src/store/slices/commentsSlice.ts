import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { Comment } from '@/lib/domain/types';

/**
 * Client-only threaded comments, keyed by backend task id. The backend has no
 * comments table; these persist locally and broadcast over the realtime bus so
 * other tabs (and, with a server, other users) see them live.
 */
export interface CommentsState {
  byTaskId: Record<number, Comment[]>;
}

const initialState: CommentsState = { byTaskId: {} };

const commentsSlice = createSlice({
  name: 'comments',
  initialState,
  reducers: {
    addComment: {
      reducer(state, action: PayloadAction<Comment>) {
        (state.byTaskId[action.payload.taskId] ??= []).push(action.payload);
      },
      prepare(input: {
        taskId: number;
        authorId: number;
        body: string;
        createdAt: string;
        parentId?: string | null;
      }) {
        return {
          payload: {
            id: `cm-${nanoid(8)}`,
            taskId: input.taskId,
            authorId: input.authorId,
            body: input.body.trim(),
            createdAt: input.createdAt,
            reactions: {},
            parentId: input.parentId ?? null,
          } satisfies Comment,
        };
      },
    },
    /** Idempotent insert used by the realtime bus (skips echoes of our own comment). */
    receiveComment(state, action: PayloadAction<Comment>) {
      const list = (state.byTaskId[action.payload.taskId] ??= []);
      if (!list.some((c) => c.id === action.payload.id)) list.push(action.payload);
    },
    toggleReaction(
      state,
      action: PayloadAction<{ taskId: number; commentId: string; emoji: string; userId: number }>
    ) {
      const c = state.byTaskId[action.payload.taskId]?.find((x) => x.id === action.payload.commentId);
      if (!c) return;
      const users = (c.reactions[action.payload.emoji] ??= []);
      c.reactions[action.payload.emoji] = users.includes(action.payload.userId)
        ? users.filter((u) => u !== action.payload.userId)
        : [...users, action.payload.userId];
      if (c.reactions[action.payload.emoji].length === 0) delete c.reactions[action.payload.emoji];
    },
    removeComment(state, action: PayloadAction<{ taskId: number; commentId: string }>) {
      const list = state.byTaskId[action.payload.taskId];
      if (list) state.byTaskId[action.payload.taskId] = list.filter((c) => c.id !== action.payload.commentId);
    },
  },
});

export const { addComment, receiveComment, toggleReaction, removeComment } = commentsSlice.actions;
export default commentsSlice.reducer;
