'use client';

import { useMemo } from 'react';
import { useGetBoardQuery } from '@/store/api/backendApi';
import { useAppSelector } from '@/store/hooks';
import { selectListById, selectStatusSetForList, selectRichById, selectPrefsByList } from '@/store/selectors';
import { DEFAULT_PREFS, defaultRich, type ListViewPrefs } from '@/store/slices/tasksSlice';
import { PRIORITY_META } from '@/lib/domain/defaults';
import { effectivePriority } from '@/lib/domain/priority';
import type { StatusDef, StatusSet, TaskRich, TaskVM } from '@/lib/domain/types';
import type { Task } from '@/lib/types';
import type { DynamicBoard } from '@/store/api/backendApi';

export interface StatusColumn {
  status: StatusDef;
  tasks: TaskVM[];
}

export interface ListData {
  projectId: number | null;
  statusSet: StatusSet;
  columns: StatusColumn[];
  allTasks: TaskVM[];
  prefs: ListViewPrefs;
  isLoading: boolean;
  isError: boolean;
}

function flatten(board: DynamicBoard): Task[] {
  return Object.values(board).flat();
}

/** A synthetic status for a backend status name that has no def in the set yet. */
function fallbackStatus(name: string, order: number): StatusDef {
  return { id: `name:${name}`, name, hue: 220, group: 'active', order, backendStatus: null };
}

/**
 * Resolve a task's status from its backend status NAME (the source of truth now
 * that statuses persist server-side). Matches a def by name; if none exists yet,
 * a fallback column is synthesized so no task is ever hidden.
 */
function resolveStatus(name: string, set: StatusSet, fallbacks: Map<string, StatusDef>): StatusDef {
  const def = set.statuses.find((s) => s.name === name);
  if (def) return def;
  let fb = fallbacks.get(name);
  if (!fb) {
    fb = fallbackStatus(name, set.statuses.length + fallbacks.size);
    fallbacks.set(name, fb);
  }
  return fb;
}

function toVM(
  task: Task,
  listId: string,
  set: StatusSet,
  richById: Record<number, TaskRich>,
  fallbacks: Map<string, StatusDef>
): TaskVM {
  const rich = richById[task.id] ?? defaultRich(task.id, null);
  const status = resolveStatus(task.status, set, fallbacks);
  return {
    id: task.id,
    listId,
    title: task.title,
    assignee: task.assignee,
    createdBy: task.createdBy,
    dueDate: task.dueDate,
    isOverdue: task.isOverdue,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    status,
    rich: { ...rich, statusId: status.id },
  };
}

function matchesFilters(vm: TaskVM, prefs: ListViewPrefs): boolean {
  if (prefs.search && !vm.title.toLowerCase().includes(prefs.search.toLowerCase())) return false;
  if (prefs.filterAssigneeIds.length) {
    if (!vm.assignee || !prefs.filterAssigneeIds.includes(vm.assignee.id)) return false;
  }
  if (prefs.filterTagIds.length) {
    if (!prefs.filterTagIds.some((t) => vm.rich.tagIds.includes(t))) return false;
  }
  if (prefs.filterPriorities.length && !prefs.filterPriorities.includes(vm.rich.priority)) return false;
  if (prefs.filterStatusIds.length && !prefs.filterStatusIds.includes(vm.status.id)) return false;
  if (prefs.filterSprintId && vm.rich.sprintId !== prefs.filterSprintId) return false;
  if (prefs.filterCreatedBy && vm.createdBy?.id !== prefs.filterCreatedBy) return false;
  if (!matchesDueFilter(vm, prefs.filterDue)) return false;
  if (!prefs.showDone && vm.status.group === 'done') return false;
  return true;
}

function matchesDueFilter(vm: TaskVM, filter: ListViewPrefs['filterDue']): boolean {
  if (filter === 'any') return true;
  if (filter === 'none') return !vm.dueDate;
  if (filter === 'overdue') return vm.isOverdue;
  if (!vm.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (filter === 'today') return vm.dueDate === today;
  if (filter === 'week') {
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    return vm.dueDate >= today && vm.dueDate <= weekAhead.toISOString().slice(0, 10);
  }
  return true;
}

export interface TaskGroup {
  key: string;
  label: string;
  hue: number;
  tasks: TaskVM[];
}

const PRIORITY_ORDER: TaskVM['rich']['priority'][] = ['urgent', 'high', 'normal', 'low', 'none'];

/**
 * Groups tasks by assignee or priority for List/Table views. Status grouping is
 * handled separately (via `columns` below) since it's also what the Board's
 * columns are — keeping one computation for both avoids divergence.
 */
export function groupTasksBy(tasks: TaskVM[], groupBy: 'assignee' | 'priority'): TaskGroup[] {
  if (groupBy === 'priority') {
    return PRIORITY_ORDER.map((p) => ({
      key: p,
      label: PRIORITY_META[p].label,
      hue: PRIORITY_META[p].hue,
      tasks: tasks.filter((t) => t.rich.priority === p),
    })).filter((g) => g.tasks.length > 0);
  }
  const map = new Map<string, TaskGroup>();
  for (const t of tasks) {
    const key = t.assignee ? String(t.assignee.id) : 'unassigned';
    if (!map.has(key)) map.set(key, { key, label: t.assignee?.name ?? 'Unassigned', hue: 220, tasks: [] });
    map.get(key)!.tasks.push(t);
  }
  return [...map.values()].sort((a, b) =>
    a.key === 'unassigned' ? 1 : b.key === 'unassigned' ? -1 : a.label.localeCompare(b.label)
  );
}

/**
 * How urgent an *incomplete* task is — higher floats to the top. Completed tasks
 * score below everything so they sink. Combines priority with deadline proximity
 * so a high-priority item, or one whose deadline is very close, comes up first.
 */
function urgencyScore(vm: TaskVM): number {
  if (vm.status.group === 'done') return -100;
  // effectivePriority already folds in the deadline, so ranking by it makes
  // high-priority AND near-deadline tasks rise to the top of the column.
  return 4 - PRIORITY_META[effectivePriority(vm)].rank; // urgent 4 … none 0
}

function sortTasks(tasks: TaskVM[], sortBy: ListViewPrefs['sortBy']): TaskVM[] {
  const copy = tasks.slice();
  switch (sortBy) {
    case 'due':
      return copy.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    case 'priority':
      return copy.sort((a, b) => PRIORITY_META[a.rich.priority].rank - PRIORITY_META[b.rich.priority].rank);
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case 'manual':
    default:
      // Urgency-first, then the user's manual drag order as a stable tiebreaker.
      return copy.sort(
        (a, b) => urgencyScore(b) - urgencyScore(a) || a.rich.order - b.rich.order || a.id - b.id
      );
  }
}

/**
 * The single read model for every view. Resolves the list's backend project,
 * fetches its board (RTK Query), fuses each task with rich fields + custom
 * statuses, applies the list's filters/sort, and groups into status columns
 * ordered by the (fully user-controlled) status set.
 */
/**
 * A single task's full view model, ignoring the list's filters (so an open detail
 * drawer still resolves even when the task is filtered out of the current view).
 */
export function useTaskVM(listId: string, taskId: number | null): TaskVM | null {
  const list = useAppSelector(selectListById(listId));
  const set = useAppSelector(selectStatusSetForList(listId));
  const richById = useAppSelector(selectRichById);
  const projectId = list?.backendProjectId ?? null;
  const { data: board } = useGetBoardQuery(projectId as number, { skip: projectId == null });

  return useMemo(() => {
    if (!board || !set || taskId == null) return null;
    const task = flatten(board).find((t) => t.id === taskId);
    return task ? toVM(task, listId, set, richById, new Map()) : null;
  }, [board, set, richById, taskId, listId]);
}

export function useListData(listId: string): ListData {
  const list = useAppSelector(selectListById(listId));
  const set = useAppSelector(selectStatusSetForList(listId));
  const richById = useAppSelector(selectRichById);
  const prefsMap = useAppSelector(selectPrefsByList);
  const projectId = list?.backendProjectId ?? null;

  const { data: board, isLoading, isError } = useGetBoardQuery(projectId as number, {
    skip: projectId == null,
  });

  // Merge onto a fresh object only when the STORED prefs reference actually changes,
  // so this doesn't invalidate the columns useMemo below on every unrelated render.
  const storedPrefs = prefsMap[listId];
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...storedPrefs }), [storedPrefs]);

  return useMemo<ListData>(() => {
    if (!board || !set) {
      return { projectId, statusSet: set, columns: [], allTasks: [], prefs, isLoading, isError };
    }
    const fallbacks = new Map<string, StatusDef>();
    const allTasks = flatten(board)
      .map((t) => toVM(t, listId, set, richById, fallbacks))
      .filter((vm) => matchesFilters(vm, prefs));

    // Columns = the user's status set, plus any status name present in data that
    // isn't in the set yet (so custom statuses created elsewhere still render).
    // Archived statuses are hidden UNLESS they still hold tasks — so archiving
    // never loses work; the column disappears once its tasks are moved out.
    const orderedStatuses = [...set.statuses, ...fallbacks.values()].sort((a, b) => a.order - b.order);
    const columns: StatusColumn[] = orderedStatuses
      .map((status) => ({
        status,
        tasks: sortTasks(
          allTasks.filter((vm) => vm.status.id === status.id),
          prefs.sortBy
        ),
      }))
      .filter((col) => !col.status.archived || col.tasks.length > 0);

    return { projectId, statusSet: set, columns, allTasks, prefs, isLoading, isError };
  }, [board, set, richById, prefs, listId, projectId, isLoading, isError]);
}
