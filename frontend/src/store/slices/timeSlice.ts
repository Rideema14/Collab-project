import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Client-only time tracking: a log of time entries per task plus a single running
 * timer. Stopping the timer converts elapsed time into an entry; totals roll up
 * into the task's timeSpentMinutes (via useTimeActions) and the dashboard.
 */
export interface TimeEntry {
  id: string;
  taskId: number;
  userId: number | null;
  minutes: number;
  note: string;
  at: string;
}

export interface RunningTimer {
  taskId: number;
  startedAt: number; // epoch ms
}

export interface TimeState {
  entries: TimeEntry[];
  running: RunningTimer | null;
}

const initialState: TimeState = { entries: [], running: null };

const timeSlice = createSlice({
  name: 'time',
  initialState,
  reducers: {
    startTimer: {
      reducer(state, action: PayloadAction<RunningTimer>) {
        state.running = action.payload;
      },
      prepare(taskId: number) {
        return { payload: { taskId, startedAt: Date.now() } satisfies RunningTimer };
      },
    },
    clearTimer(state) {
      state.running = null;
    },
    addEntry: {
      reducer(state, action: PayloadAction<TimeEntry>) {
        state.entries.unshift(action.payload);
      },
      prepare(input: { taskId: number; userId: number | null; minutes: number; note?: string }) {
        return {
          payload: {
            id: `te-${nanoid(7)}`,
            taskId: input.taskId,
            userId: input.userId,
            minutes: Math.max(0, Math.round(input.minutes)),
            note: input.note?.trim() ?? '',
            at: new Date().toISOString(),
          } satisfies TimeEntry,
        };
      },
    },
    removeEntry(state, action: PayloadAction<string>) {
      state.entries = state.entries.filter((e) => e.id !== action.payload);
    },
  },
});

export const { startTimer, clearTimer, addEntry, removeEntry } = timeSlice.actions;
export default timeSlice.reducer;
