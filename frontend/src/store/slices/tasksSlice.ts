import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type {
  Checklist,
  ChecklistItem,
  Dependency,
  DependencyType,
  Priority,
  Subtask,
  TaskRich,
} from '@/lib/domain/types';

/**
 * Client-only rich task data + per-list view preferences.
 *
 * The backend task (title/status/assignee/dueDate) is owned by the server and
 * cached by RTK Query. This slice holds everything the backend can't store,
 * keyed by the same numeric task id. Records are created lazily via `ensureRich`
 * with sensible defaults, so a task that has never been enriched still renders.
 */
export type ViewKind = 'board' | 'list' | 'table' | 'calendar' | 'timeline' | 'workload' | 'gantt';

export interface ListViewPrefs {
  view: ViewKind;
  groupBy: 'status' | 'assignee' | 'priority';
  sortBy: 'manual' | 'due' | 'priority' | 'title';
  density: 'comfortable' | 'compact';
  search: string;
  filterAssigneeIds: number[];
  filterTagIds: string[];
  showDone: boolean;
}

export interface TasksState {
  richById: Record<number, TaskRich>;
  prefsByList: Record<string, ListViewPrefs>;
}

const initialState: TasksState = { richById: {}, prefsByList: {} };

export const DEFAULT_PREFS: ListViewPrefs = {
  view: 'board',
  groupBy: 'status',
  sortBy: 'manual',
  density: 'comfortable',
  search: '',
  filterAssigneeIds: [],
  filterTagIds: [],
  showDone: true,
};

export function defaultRich(taskId: number, statusId: string | null): TaskRich {
  return {
    taskId,
    statusId,
    priority: 'none',
    estimateMinutes: null,
    timeSpentMinutes: 0,
    description: '',
    subtasks: [],
    checklists: [],
    tagIds: [],
    dependencies: [],
    watcherIds: [],
    attachments: [],
    order: 0,
    coverHue: null,
  };
}

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    ensureRich(state, action: PayloadAction<{ taskId: number; statusId: string | null }>) {
      if (!state.richById[action.payload.taskId]) {
        state.richById[action.payload.taskId] = defaultRich(
          action.payload.taskId,
          action.payload.statusId
        );
      }
    },
    setStatusId(state, action: PayloadAction<{ taskId: number; statusId: string; order?: number }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.statusId = action.payload.statusId;
      if (action.payload.order !== undefined) r.order = action.payload.order;
    },
    setOrder(state, action: PayloadAction<{ taskId: number; order: number }>) {
      const r = state.richById[action.payload.taskId];
      if (r) r.order = action.payload.order;
    },
    setPriority(state, action: PayloadAction<{ taskId: number; priority: Priority }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.priority = action.payload.priority;
    },
    setDescription(state, action: PayloadAction<{ taskId: number; description: string }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.description = action.payload.description;
    },
    setEstimate(state, action: PayloadAction<{ taskId: number; minutes: number | null }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.estimateMinutes = action.payload.minutes;
    },
    // ---- subtasks ----
    addSubtask: {
      reducer(state, action: PayloadAction<{ taskId: number; subtask: Subtask }>) {
        const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
        r.subtasks.push(action.payload.subtask);
      },
      prepare(input: { taskId: number; title: string }) {
        return {
          payload: {
            taskId: input.taskId,
            subtask: { id: `sub-${nanoid(6)}`, title: input.title.trim(), done: false, assigneeId: null },
          },
        };
      },
    },
    toggleSubtask(state, action: PayloadAction<{ taskId: number; subtaskId: string }>) {
      const st = state.richById[action.payload.taskId]?.subtasks.find((s) => s.id === action.payload.subtaskId);
      if (st) st.done = !st.done;
    },
    removeSubtask(state, action: PayloadAction<{ taskId: number; subtaskId: string }>) {
      const r = state.richById[action.payload.taskId];
      if (r) r.subtasks = r.subtasks.filter((s) => s.id !== action.payload.subtaskId);
    },
    // ---- checklists ----
    addChecklist: {
      reducer(state, action: PayloadAction<{ taskId: number; checklist: Checklist }>) {
        const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
        r.checklists.push(action.payload.checklist);
      },
      prepare(input: { taskId: number; name: string }) {
        return {
          payload: {
            taskId: input.taskId,
            checklist: { id: `cl-${nanoid(6)}`, name: input.name.trim() || 'Checklist', items: [] },
          },
        };
      },
    },
    addChecklistItem: {
      reducer(state, action: PayloadAction<{ taskId: number; checklistId: string; item: ChecklistItem }>) {
        const cl = state.richById[action.payload.taskId]?.checklists.find(
          (c) => c.id === action.payload.checklistId
        );
        if (cl) cl.items.push(action.payload.item);
      },
      prepare(input: { taskId: number; checklistId: string; text: string }) {
        return {
          payload: {
            taskId: input.taskId,
            checklistId: input.checklistId,
            item: { id: `ci-${nanoid(6)}`, text: input.text.trim(), done: false },
          },
        };
      },
    },
    toggleChecklistItem(
      state,
      action: PayloadAction<{ taskId: number; checklistId: string; itemId: string }>
    ) {
      const cl = state.richById[action.payload.taskId]?.checklists.find(
        (c) => c.id === action.payload.checklistId
      );
      const item = cl?.items.find((i) => i.id === action.payload.itemId);
      if (item) item.done = !item.done;
    },
    // ---- tags / deps / watchers ----
    setTags(state, action: PayloadAction<{ taskId: number; tagIds: string[] }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.tagIds = action.payload.tagIds;
    },
    addDependency: {
      reducer(state, action: PayloadAction<{ taskId: number; dependency: Dependency }>) {
        const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
        r.dependencies.push(action.payload.dependency);
      },
      prepare(input: { taskId: number; otherTaskId: number; type: DependencyType }) {
        return {
          payload: {
            taskId: input.taskId,
            dependency: { id: `dep-${nanoid(6)}`, taskId: input.otherTaskId, type: input.type },
          },
        };
      },
    },
    toggleWatcher(state, action: PayloadAction<{ taskId: number; userId: number }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.watcherIds = r.watcherIds.includes(action.payload.userId)
        ? r.watcherIds.filter((id) => id !== action.payload.userId)
        : [...r.watcherIds, action.payload.userId];
    },
    // ---- view prefs ----
    setViewPrefs(state, action: PayloadAction<{ listId: string; changes: Partial<ListViewPrefs> }>) {
      const cur = state.prefsByList[action.payload.listId] ?? DEFAULT_PREFS;
      state.prefsByList[action.payload.listId] = { ...cur, ...action.payload.changes };
    },
  },
});

export const {
  ensureRich,
  setStatusId,
  setOrder,
  setPriority,
  setDescription,
  setEstimate,
  addSubtask,
  toggleSubtask,
  removeSubtask,
  addChecklist,
  addChecklistItem,
  toggleChecklistItem,
  setTags,
  addDependency,
  toggleWatcher,
  setViewPrefs,
} = tasksSlice.actions;

export default tasksSlice.reducer;
