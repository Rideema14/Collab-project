import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { SprintDef } from '@/lib/domain/types';

/** Per-list sprints (CLIENT-ONLY) — see SprintDef doc comment for scope. */
export interface SprintsState {
  byList: Record<string, SprintDef[]>;
}

const initialState: SprintsState = { byList: {} };

const sprintsSlice = createSlice({
  name: 'sprints',
  initialState,
  reducers: {
    addSprint: {
      reducer(state, action: PayloadAction<SprintDef>) {
        (state.byList[action.payload.listId] ??= []).push(action.payload);
      },
      prepare(input: { listId: string; name: string }) {
        return { payload: { id: `sprint-${nanoid(6)}`, listId: input.listId, name: input.name.trim() || 'New sprint' } };
      },
    },
    removeSprint(state, action: PayloadAction<{ listId: string; sprintId: string }>) {
      const list = state.byList[action.payload.listId];
      if (list) state.byList[action.payload.listId] = list.filter((s) => s.id !== action.payload.sprintId);
    },
  },
});

export const { addSprint, removeSprint } = sprintsSlice.actions;
export default sprintsSlice.reducer;
