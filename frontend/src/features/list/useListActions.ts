'use client';

import { useCallback } from 'react';
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
  useUpdateTaskStatusMutation,
} from '@/store/api/backendApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectListById, selectSessionUser, selectStatusSetForList } from '@/store/selectors';
import { setStatusId } from '@/store/slices/tasksSlice';
import { addActivity } from '@/store/slices/activitySlice';
import { logAudit } from '@/store/slices/orgSlice';
import type { StatusDef } from '@/lib/domain/types';

/**
 * Coordinated task actions for a list. A status move is the interesting one: the
 * fine-grained client status is ALWAYS recorded locally (so custom statuses like
 * "Backlog"/"In Review" work), and IF that status maps to a backend enum value,
 * the server is PATCHed too — keeping the two in sync without pretending the
 * backend understands a status it doesn't.
 */
export function useListActions(listId: string) {
  const dispatch = useAppDispatch();
  const list = useAppSelector(selectListById(listId));
  const set = useAppSelector(selectStatusSetForList(listId));
  const user = useAppSelector(selectSessionUser);
  const projectId = list?.backendProjectId ?? null;

  const [createTaskMut] = useCreateTaskMutation();
  const [updateStatusMut] = useUpdateTaskStatusMutation();
  const [updateTaskMut] = useUpdateTaskMutation();
  const [deleteTaskMut] = useDeleteTaskMutation();

  const now = () => new Date().toISOString();

  const createTask = useCallback(
    async (input: { title: string; statusId?: string; assigneeId?: number | null; dueDate?: string | null }) => {
      if (projectId == null) return;
      // Resolve the target status NAME so the task is created in the right column
      // server-side (backend persists arbitrary status names now).
      const targetDef = input.statusId ? set?.statuses.find((s) => s.id === input.statusId) : undefined;
      const statusName = targetDef?.name;
      const created = await createTaskMut({
        projectId,
        title: input.title,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
        status: statusName,
      }).unwrap();
      if (input.statusId) dispatch(setStatusId({ taskId: created.id, statusId: input.statusId, order: 0 }));
      dispatch(addActivity({ projectId, kind: 'created', message: `created “${input.title}”`, at: now() }));
      if (user) dispatch(logAudit({ actorId: user.id, action: 'task.create', target: input.title, at: now() }));
      return created;
    },
    [projectId, createTaskMut, set, dispatch, user]
  );

  const moveToStatus = useCallback(
    async (taskId: number, status: StatusDef, order = 0) => {
      if (projectId == null) return;
      // Record local ordering + intent for instant, offline-safe grouping…
      dispatch(setStatusId({ taskId, statusId: status.id, order }));
      dispatch(addActivity({ projectId, kind: 'moved', message: `moved a task to ${status.name}`, at: now() }));
      // …and persist the status NAME to the backend (every status now syncs).
      try {
        await updateStatusMut({ projectId, taskId, status: status.name }).unwrap();
      } catch {
        /* optimistic patch in the mutation rolls back; local intent remains */
      }
    },
    [projectId, dispatch, updateStatusMut]
  );

  const updateTask = useCallback(
    async (taskId: number, input: Partial<{ title: string; assigneeId: number | null; dueDate: string | null }>) => {
      if (projectId == null) return;
      await updateTaskMut({ projectId, taskId, input }).unwrap();
      dispatch(addActivity({ projectId, kind: 'updated', message: 'updated a task', at: now() }));
    },
    [projectId, updateTaskMut, dispatch]
  );

  const deleteTask = useCallback(
    async (taskId: number, title?: string) => {
      if (projectId == null) return;
      await deleteTaskMut({ projectId, taskId }).unwrap();
      dispatch(addActivity({ projectId, kind: 'deleted', message: `deleted ${title ? `“${title}”` : 'a task'}`, at: now() }));
      if (user) dispatch(logAudit({ actorId: user.id, action: 'task.delete', target: title ?? String(taskId), at: now() }));
    },
    [projectId, deleteTaskMut, dispatch, user]
  );

  return { projectId, createTask, moveToStatus, updateTask, deleteTask };
}
