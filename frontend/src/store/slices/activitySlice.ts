import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

/**
 * A CLIENT-SIDE activity log.
 *
 * The backend keeps no audit trail, so this records the actions the user takes
 * in this app — a task created, moved, edited, deleted — as they happen, scoped
 * per project. It persists across sessions (see persistence.ts) so the Activity
 * view is a real, growing feed rather than a stub. When the backend grows a true
 * activity endpoint, swap the local dispatches for a fetch; the view is unchanged.
 */
export type ActivityKind = 'created' | 'updated' | 'moved' | 'deleted';

export interface ActivityEntry {
  id: string;
  projectId: number;
  kind: ActivityKind;
  message: string;
  /** ISO timestamp, passed in by the dispatcher to keep the reducer pure. */
  at: string;
}

export interface ActivityState {
  items: ActivityEntry[];
}

const initialState: ActivityState = { items: [] };

const MAX_ITEMS = 200;

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    addActivity: {
      reducer(state, action: PayloadAction<ActivityEntry>) {
        state.items.unshift(action.payload);
        if (state.items.length > MAX_ITEMS) state.items.length = MAX_ITEMS;
      },
      prepare(input: { projectId: number; kind: ActivityKind; message: string; at: string }) {
        return { payload: { id: nanoid(), ...input } satisfies ActivityEntry };
      },
    },
    hydrateActivity(state, action: PayloadAction<{ items?: ActivityEntry[] }>) {
      if (Array.isArray(action.payload.items)) state.items = action.payload.items;
    },
  },
});

export const { addActivity, hydrateActivity } = activitySlice.actions;

export default activitySlice.reducer;
