import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type {
  Attachment,
  Checklist,
  ChecklistItem,
  Dependency,
  DependencyType,
  Priority,
  Subtask,
  SubtaskStatus,
  TaskRich,
} from '@/lib/domain/types';

/** Quick due-date buckets for filtering — simpler and more useful than a raw date-range picker. */
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';

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
  filterPriorities: Priority[];
  filterStatusIds: string[];
  filterSprintId: string | null;
  filterCreatedBy: number | null;
  filterDue: DueFilter;
  showDone: boolean;
}

/** A named, savable snapshot of a list's view preferences (search/filters/group/sort/view). */
export interface SavedView {
  id: string;
  listId: string;
  name: string;
  prefs: ListViewPrefs;
}

export interface TasksState {
  richById: Record<number, TaskRich>;
  prefsByList: Record<string, ListViewPrefs>;
  savedViews: SavedView[];
}

const initialState: TasksState = { richById: {}, prefsByList: {}, savedViews: [] };

export const DEFAULT_PREFS: ListViewPrefs = {
  view: 'board',
  groupBy: 'status',
  sortBy: 'manual',
  density: 'comfortable',
  search: '',
  filterAssigneeIds: [],
  filterTagIds: [],
  filterPriorities: [],
  filterStatusIds: [],
  filterSprintId: null,
  filterCreatedBy: null,
  filterDue: 'any',
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
    sprintId: null,
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
            subtask: {
              id: `sub-${nanoid(6)}`,
              title: input.title.trim(),
              done: false,
              status: 'todo' as SubtaskStatus,
              assigneeId: null,
              priority: 'none' as Priority,
              dueDate: null,
            },
          },
        };
      },
    },
    /** Quick checkbox toggle — flips between done and todo (use setSubtaskStatus for the full 3-state control). */
    toggleSubtask(state, action: PayloadAction<{ taskId: number; subtaskId: string }>) {
      const st = state.richById[action.payload.taskId]?.subtasks.find((s) => s.id === action.payload.subtaskId);
      if (st) {
        st.done = !st.done;
        st.status = st.done ? 'done' : 'todo';
      }
    },
    setSubtaskStatus(state, action: PayloadAction<{ taskId: number; subtaskId: string; status: SubtaskStatus }>) {
      const st = state.richById[action.payload.taskId]?.subtasks.find((s) => s.id === action.payload.subtaskId);
      if (st) {
        st.status = action.payload.status;
        st.done = action.payload.status === 'done';
      }
    },
    setSubtaskPriority(state, action: PayloadAction<{ taskId: number; subtaskId: string; priority: Priority }>) {
      const st = state.richById[action.payload.taskId]?.subtasks.find((s) => s.id === action.payload.subtaskId);
      if (st) st.priority = action.payload.priority;
    },
    setSubtaskDueDate(state, action: PayloadAction<{ taskId: number; subtaskId: string; dueDate: string | null }>) {
      const st = state.richById[action.payload.taskId]?.subtasks.find((s) => s.id === action.payload.subtaskId);
      if (st) st.dueDate = action.payload.dueDate;
    },
    setSubtaskAssignee(state, action: PayloadAction<{ taskId: number; subtaskId: string; assigneeId: number | null }>) {
      const st = state.richById[action.payload.taskId]?.subtasks.find((s) => s.id === action.payload.subtaskId);
      if (st) st.assigneeId = action.payload.assigneeId;
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
    removeDependency(state, action: PayloadAction<{ taskId: number; dependencyId: string }>) {
      const r = state.richById[action.payload.taskId];
      if (r) r.dependencies = r.dependencies.filter((d) => d.id !== action.payload.dependencyId);
    },
    // ---- attachments (client-only, stored as data URLs) ----
    addAttachment: {
      reducer(state, action: PayloadAction<{ taskId: number; attachment: Attachment }>) {
        const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
        r.attachments.push(action.payload.attachment);
      },
      prepare(input: { taskId: number; name: string; url: string; size: number; mime: string }) {
        return {
          payload: {
            taskId: input.taskId,
            attachment: {
              id: `att-${nanoid(6)}`,
              name: input.name,
              url: input.url,
              size: input.size,
              mime: input.mime,
              addedAt: new Date().toISOString(),
            },
          },
        };
      },
    },
    removeAttachment(state, action: PayloadAction<{ taskId: number; attachmentId: string }>) {
      const r = state.richById[action.payload.taskId];
      if (r) r.attachments = r.attachments.filter((a) => a.id !== action.payload.attachmentId);
    },
    // ---- time tracking ----
    logTime(state, action: PayloadAction<{ taskId: number; minutes: number }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.timeSpentMinutes = Math.max(0, r.timeSpentMinutes + action.payload.minutes);
    },
    setTimeSpent(state, action: PayloadAction<{ taskId: number; minutes: number }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.timeSpentMinutes = Math.max(0, action.payload.minutes);
    },
    toggleWatcher(state, action: PayloadAction<{ taskId: number; userId: number }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.watcherIds = r.watcherIds.includes(action.payload.userId)
        ? r.watcherIds.filter((id) => id !== action.payload.userId)
        : [...r.watcherIds, action.payload.userId];
    },
    // ---- sprint ----
    setSprint(state, action: PayloadAction<{ taskId: number; sprintId: string | null }>) {
      const r = (state.richById[action.payload.taskId] ??= defaultRich(action.payload.taskId, null));
      r.sprintId = action.payload.sprintId;
    },
    // ---- view prefs ----
    setViewPrefs(state, action: PayloadAction<{ listId: string; changes: Partial<ListViewPrefs> }>) {
      const cur = state.prefsByList[action.payload.listId];
      state.prefsByList[action.payload.listId] = { ...DEFAULT_PREFS, ...cur, ...action.payload.changes };
    },
    // ---- saved views ----
    saveView: {
      reducer(state, action: PayloadAction<SavedView>) {
        state.savedViews.push(action.payload);
      },
      prepare(input: { listId: string; name: string; prefs: ListViewPrefs }) {
        return {
          payload: {
            id: `view-${nanoid(6)}`,
            listId: input.listId,
            name: input.name.trim() || 'Untitled view',
            prefs: input.prefs,
          },
        };
      },
    },
    deleteView(state, action: PayloadAction<{ id: string }>) {
      state.savedViews = state.savedViews.filter((v) => v.id !== action.payload.id);
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
  setSubtaskStatus,
  setSubtaskPriority,
  setSubtaskDueDate,
  setSubtaskAssignee,
  removeSubtask,
  addChecklist,
  addChecklistItem,
  toggleChecklistItem,
  setTags,
  addDependency,
  removeDependency,
  addAttachment,
  removeAttachment,
  logTime,
  setTimeSpent,
  toggleWatcher,
  setSprint,
  setViewPrefs,
  saveView,
  deleteView,
} = tasksSlice.actions;

export default tasksSlice.reducer;
