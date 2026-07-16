'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/hooks';
import {
  backendApi,
  useCreateProjectMutation,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
  useUpdateTaskStatusMutation,
  useGetUsersQuery,
} from '@/store/api/backendApi';
import {
  addList,
  updateList,
  assignListStatusSet,
  DEFAULT_SPACE_ID,
} from '@/store/slices/hierarchySlice';
import { setPriority } from '@/store/slices/tasksSlice';
import { addStatus, updateStatus, removeStatus, cloneSetForList } from '@/store/slices/statusesSlice';
import { selectStatusSetForList } from '@/store/selectors';
import { STATUS_HUES } from '@/lib/domain/status-color';
import { daysUntilDue } from '@/lib/format';
import type { AiAction, AiFilter, AiPlan, User } from '@/lib/types';
import type { List, Priority } from '@/lib/domain/types';
import type { RootState } from '@/store/store';

interface Enriched {
  id: number;
  title: string;
  status: string;
  dueDate: string | null;
  isOverdue: boolean;
  assignee: User | null;
  projectId: number;
  listId: string;
  priority: Priority;
}

const VALID_PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];

/**
 * The AI Action Layer. Takes a structured plan from the assistant and executes it
 * against the SAME APIs and Redux actions the rest of the app uses — the AI never
 * touches the database directly. Every executor resolves fuzzy names (projects,
 * users, tasks, statuses) against current workspace state, then calls the exact
 * mutation/reducer the manual UI would.
 */
export function useAiExecutor() {
  const store = useAppStore();
  const router = useRouter();
  const { data: users } = useGetUsersQuery();

  const [createProject] = useCreateProjectMutation();
  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [updateTaskStatus] = useUpdateTaskStatusMutation();
  const [deleteTask] = useDeleteTaskMutation();

  const runPlan = useCallback(
    async (plan: AiPlan): Promise<string> => {
      const state = () => store.getState() as RootState;
      const now = () => new Date().toISOString();

      // ---------- resolution helpers ----------
      const activeLists = () => state().hierarchy.lists.filter((l) => !l.archived);
      const resolveList = (name?: string): List | null => {
        const lists = activeLists();
        if (!name) return null;
        const q = name.toLowerCase();
        return (
          lists.find((l) => l.name.toLowerCase() === q) ??
          lists.find((l) => l.name.toLowerCase().includes(q)) ??
          null
        );
      };
      const currentList = (): List | null => {
        const id = state().ui.activeListId;
        return activeLists().find((l) => l.id === id) ?? activeLists()[0] ?? null;
      };
      const resolveUser = (name?: string): User | null => {
        if (!name || !users) return null;
        const q = name.toLowerCase();
        return (
          users.find((u) => u.name.toLowerCase() === q) ??
          users.find((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) ??
          null
        );
      };

      const enrich = (t: { id: number; title: string; status: string; dueDate: string | null; isOverdue: boolean; assignee: User | null }, list: List): Enriched => ({
        ...t,
        projectId: list.backendProjectId,
        listId: list.id,
        priority: state().tasks.richById[t.id]?.priority ?? 'none',
      });

      const loadListTasks = async (list: List): Promise<Enriched[]> => {
        const sub = store.dispatch(backendApi.endpoints.getBoard.initiate(list.backendProjectId));
        try {
          const board = await sub.unwrap();
          return Object.values(board).flat().map((t) => enrich(t, list));
        } catch {
          return [];
        } finally {
          sub.unsubscribe();
        }
      };
      const loadAllTasks = async (): Promise<Enriched[]> => {
        const results = await Promise.all(activeLists().map(loadListTasks));
        return results.flat();
      };

      const matchesFilter = (t: Enriched, f: AiFilter): boolean => {
        if (f.project) {
          const l = resolveList(f.project);
          if (!l || l.id !== t.listId) return false;
        }
        if (f.assignee) {
          const u = resolveUser(f.assignee);
          if (!u || t.assignee?.id !== u.id) return false;
        }
        if (f.status && t.status.toLowerCase() !== f.status.toLowerCase()) return false;
        if (f.priority && t.priority !== f.priority) return false;
        if (f.overdue && !t.isOverdue) return false;
        if (f.dueToday) {
          const d = daysUntilDue(t.dueDate);
          if (d !== 0) return false;
        }
        if (f.dueThisWeek) {
          const d = daysUntilDue(t.dueDate);
          if (!(d >= 0 && d <= 7)) return false;
        }
        if (f.text && !t.title.toLowerCase().includes(f.text.toLowerCase())) return false;
        return true;
      };

      // Resolve the target task(s) for a single-or-bulk action.
      const resolveTargets = async (action: AiAction): Promise<Enriched[]> => {
        if (action.filter) return (await loadAllTasks()).filter((t) => matchesFilter(t, action.filter!));
        if (action.task) {
          const scope = action.project ? [resolveList(action.project)].filter(Boolean) as List[] : activeLists();
          const q = action.task.toLowerCase();
          for (const list of scope) {
            const tasks = await loadListTasks(list);
            const hit = tasks.find((t) => t.title.toLowerCase() === q) ?? tasks.find((t) => t.title.toLowerCase().includes(q));
            if (hit) return [hit];
          }
        }
        return [];
      };

      const ensureOwnStatusSet = (list: List): string => {
        const current = selectStatusSetForList(list.id)(state());
        const ownId = `set-list-${list.id}`;
        if (list.statusSetId === ownId && state().statuses.sets[ownId]) return ownId;
        store.dispatch(cloneSetForList({ newSetId: ownId, sourceSetId: current.id }));
        store.dispatch(assignListStatusSet({ listId: list.id, statusSetId: ownId }));
        return ownId;
      };

      // Create a project + client list, return the List.
      const makeProject = async (name: string): Promise<List> => {
        const project = await createProject({ name }).unwrap();
        const spaceId = state().hierarchy.spaces[0]?.id ?? DEFAULT_SPACE_ID;
        const act = store.dispatch(
          addList({ backendProjectId: project.id, spaceId, folderId: null, name, createdAt: now() })
        );
        return state().hierarchy.lists.find((l) => l.id === act.payload.id)!;
      };

      // ---------- per-action executor ----------
      const runAction = async (a: AiAction): Promise<string> => {
        switch (a.type) {
          case 'create_project': {
            const list = await makeProject(a.name || 'New Project');
            router.push(`/list/${list.id}`);
            return `Created project “${list.name}” and opened it.`;
          }
          case 'rename_project': {
            const list = resolveList(a.project);
            if (!list) return `Couldn't find a project matching “${a.project}”.`;
            store.dispatch(updateList({ id: list.id, changes: { name: a.name || list.name } }));
            return `Renamed project to “${a.name}”.`;
          }
          case 'archive_project': {
            const list = resolveList(a.project);
            if (!list) return `Couldn't find a project matching “${a.project}”.`;
            store.dispatch(updateList({ id: list.id, changes: { archived: true } }));
            return `Archived “${list.name}”.`;
          }
          case 'delete_project': {
            const list = resolveList(a.project);
            if (!list) return `Couldn't find a project matching “${a.project}”.`;
            const tasks = await loadListTasks(list);
            for (const t of tasks) await deleteTask({ projectId: list.backendProjectId, taskId: t.id }).unwrap().catch(() => {});
            store.dispatch(updateList({ id: list.id, changes: { archived: true } }));
            return `Deleted “${list.name}” (${tasks.length} task${tasks.length === 1 ? '' : 's'} removed).`;
          }
          case 'create_task': {
            const list = resolveList(a.project) ?? currentList() ?? (await makeProject(a.project || 'General'));
            const assignee = resolveUser(a.assignee);
            const created = await createTask({
              projectId: list.backendProjectId,
              title: a.title || 'New task',
              assigneeId: assignee?.id ?? null,
              dueDate: a.dueDate ?? null,
              status: a.status ?? undefined,
            }).unwrap();
            if (a.priority && VALID_PRIORITIES.includes(a.priority as Priority)) {
              store.dispatch(setPriority({ taskId: created.id, priority: a.priority as Priority }));
            }
            const bits = [
              assignee ? `assigned to ${assignee.name}` : null,
              a.dueDate ? `due ${a.dueDate}` : null,
              a.status ? `in ${a.status}` : null,
            ].filter(Boolean);
            return `Created “${a.title}” in ${list.name}${bits.length ? ` (${bits.join(', ')})` : ''}.`;
          }
          case 'update_task': {
            const [t] = await resolveTargets(a);
            if (!t) return `Couldn't find task “${a.task}”.`;
            const input: { title?: string; assigneeId?: number | null; dueDate?: string | null } = {};
            if (a.title) input.title = a.title;
            if (a.assignee) input.assigneeId = resolveUser(a.assignee)?.id ?? null;
            if (a.dueDate) input.dueDate = a.dueDate;
            await updateTask({ projectId: t.projectId, taskId: t.id, input }).unwrap();
            return `Updated “${t.title}”.`;
          }
          case 'delete_task': {
            const [t] = await resolveTargets(a);
            if (!t) return `Couldn't find task “${a.task}”.`;
            await deleteTask({ projectId: t.projectId, taskId: t.id }).unwrap();
            return `Deleted “${t.title}”.`;
          }
          case 'set_status': {
            const targets = await resolveTargets(a);
            if (!targets.length) return `No matching tasks found.`;
            for (const t of targets) await updateTaskStatus({ projectId: t.projectId, taskId: t.id, status: a.status || t.status }).unwrap().catch(() => {});
            return `Moved ${targets.length} task${targets.length === 1 ? '' : 's'} to “${a.status}”.`;
          }
          case 'set_priority': {
            const targets = await resolveTargets(a);
            if (!targets.length) return `No matching tasks found.`;
            const p = (a.priority as Priority) || 'normal';
            for (const t of targets) store.dispatch(setPriority({ taskId: t.id, priority: p }));
            return `Set ${targets.length} task${targets.length === 1 ? '' : 's'} to ${p} priority.`;
          }
          case 'set_assignee': {
            const targets = await resolveTargets(a);
            if (!targets.length) return `No matching tasks found.`;
            const u = resolveUser(a.assignee);
            for (const t of targets) await updateTask({ projectId: t.projectId, taskId: t.id, input: { assigneeId: u?.id ?? null } }).unwrap().catch(() => {});
            return `Assigned ${targets.length} task${targets.length === 1 ? '' : 's'} to ${u ? u.name : 'no one'}.`;
          }
          case 'set_due': {
            const targets = await resolveTargets(a);
            if (!targets.length) return `No matching tasks found.`;
            for (const t of targets) await updateTask({ projectId: t.projectId, taskId: t.id, input: { dueDate: a.dueDate ?? null } }).unwrap().catch(() => {});
            return `Set due date on ${targets.length} task${targets.length === 1 ? '' : 's'} to ${a.dueDate}.`;
          }
          case 'create_status': {
            const list = resolveList(a.project) ?? currentList();
            if (!list) return `Couldn't find that project.`;
            const setId = ensureOwnStatusSet(list);
            const set = state().statuses.sets[setId];
            const hue = STATUS_HUES[(set?.statuses.length ?? 0) % STATUS_HUES.length];
            const group = (['not_started', 'active', 'done'].includes(a.group ?? '') ? a.group : 'active') as 'not_started' | 'active' | 'done';
            store.dispatch(addStatus({ setId, name: a.name || 'New status', hue, group }));
            return `Added status “${a.name}” to ${list.name}.`;
          }
          case 'rename_status': {
            const list = resolveList(a.project) ?? currentList();
            if (!list) return `Couldn't find that project.`;
            const setId = ensureOwnStatusSet(list);
            const st = state().statuses.sets[setId]?.statuses.find((s) => s.name.toLowerCase() === (a.status ?? '').toLowerCase());
            if (!st) return `Couldn't find status “${a.status}”.`;
            store.dispatch(updateStatus({ setId, statusId: st.id, changes: { name: a.name || st.name } }));
            return `Renamed status to “${a.name}”.`;
          }
          case 'delete_status': {
            const list = resolveList(a.project) ?? currentList();
            if (!list) return `Couldn't find that project.`;
            const setId = ensureOwnStatusSet(list);
            const st = state().statuses.sets[setId]?.statuses.find((s) => s.name.toLowerCase() === (a.status ?? '').toLowerCase());
            if (!st) return `Couldn't find status “${a.status}”.`;
            store.dispatch(removeStatus({ setId, statusId: st.id }));
            return `Deleted status “${a.status}”.`;
          }
          case 'query':
          case 'overdue': {
            const filter: AiFilter = a.type === 'overdue' ? { overdue: true } : a.filter ?? {};
            const tasks = (await loadAllTasks()).filter((t) => matchesFilter(t, filter));
            if (!tasks.length) return 'No tasks match that.';
            const lines = tasks.slice(0, 20).map((t) => {
              const meta = [t.status, t.dueDate ? `due ${t.dueDate}` : null, t.assignee ? `@${t.assignee.name}` : null].filter(Boolean).join(' · ');
              return `• ${t.title} — ${meta}`;
            });
            const more = tasks.length > 20 ? `\n…and ${tasks.length - 20} more.` : '';
            return `${a.title || 'Results'} (${tasks.length}):\n${lines.join('\n')}${more}`;
          }
          case 'summarize': {
            const scope = a.project ? [resolveList(a.project)].filter(Boolean) as List[] : activeLists();
            const tasks = (await Promise.all(scope.map(loadListTasks))).flat();
            const done = tasks.filter((t) => t.status.toLowerCase() === 'done').length;
            const overdue = tasks.filter((t) => t.isOverdue).length;
            const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            const label = a.project ? `“${resolveList(a.project)?.name ?? a.project}”` : 'the workspace';
            return `Summary of ${label}: ${tasks.length} tasks, ${done} done (${pct}%), ${tasks.length - done} active, ${overdue} overdue.`;
          }
          case 'workload': {
            const tasks = await loadAllTasks();
            const byPerson = new Map<string, { active: number; done: number }>();
            for (const t of tasks) {
              const key = t.assignee?.name ?? 'Unassigned';
              const rec = byPerson.get(key) ?? { active: 0, done: 0 };
              if (t.status.toLowerCase() === 'done') rec.done += 1;
              else rec.active += 1;
              byPerson.set(key, rec);
            }
            const lines = [...byPerson.entries()]
              .sort((x, y) => y[1].active - x[1].active)
              .map(([name, r]) => `• ${name}: ${r.active} active, ${r.done} done`);
            return `Team workload:\n${lines.join('\n')}`;
          }
          default:
            return `I don't know how to “${a.type}” yet.`;
        }
      };

      const lines: string[] = [];
      for (const action of plan.actions) {
        try {
          const line = await runAction(action);
          if (line) lines.push(line);
        } catch (err) {
          lines.push(`⚠️ Couldn't complete ${action.type}: ${(err as Error)?.message ?? 'unknown error'}`);
        }
      }
      return lines.join('\n\n');
    },
    [store, router, users, createProject, createTask, updateTask, updateTaskStatus, deleteTask]
  );

  return { runPlan };
}
