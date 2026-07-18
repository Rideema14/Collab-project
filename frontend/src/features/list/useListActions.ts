'use client';

import { useCallback } from 'react';
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
  useUpdateTaskStatusMutation,
  useGetUsersQuery,
} from '@/store/api/backendApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectListById, selectSessionUser, selectStatusSetForList } from '@/store/selectors';
import { setStatusId } from '@/store/slices/tasksSlice';
import { addActivity } from '@/store/slices/activitySlice';
import { logAudit } from '@/store/slices/orgSlice';
import { broadcast } from '@/store/middleware/socketMiddleware';
import { pushNotification, type NotificationTone } from '@/store/slices/notificationsSlice';
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
  const { data: usersList = [] } = useGetUsersQuery();

  const now = () => new Date().toISOString();
  const nameOf = useCallback(
    (id: number | null | undefined) => usersList.find((u) => u.id === id)?.name ?? 'a member',
    [usersList]
  );

  /**
   * Fire a realtime notification aimed at ONE member. Emitted over the realtime
   * bus and shown only on that member's client (see socketMiddleware) — the actor
   * never notifies themselves. Guarded so we never notify the person doing the action.
   */
  const notifyMember = useCallback(
    (targetUserId: number | null | undefined, tone: NotificationTone, title: string, body: string) => {
      if (targetUserId == null || targetUserId === user?.id) return;
      dispatch(
        broadcast({ type: 'notification:new', origin: '', targetUserId, tone, title, body, href: `/list/${listId}` })
      );
    },
    [dispatch, listId, user?.id]
  );

  /**
   * Assignment: notify the ASSIGNEE (their session only) AND drop a confirmation
   * in the ASSIGNER's own inbox so the person doing it sees it worked too.
   */
  const announceAssignment = useCallback(
    (assigneeId: number | null | undefined, title: string) => {
      if (assigneeId == null || assigneeId === user?.id) return;
      notifyMember(assigneeId, 'info', 'Task assigned to you', `${user?.name ?? 'Someone'} assigned you “${title}”`);
      dispatch(
        pushNotification({
          tone: 'success',
          title: 'Task assigned',
          body: `You assigned “${title}” to ${nameOf(assigneeId)}`,
          href: `/list/${listId}`,
          createdAt: now(),
        })
      );
    },
    [notifyMember, dispatch, listId, user?.id, user?.name, nameOf]
  );

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
      announceAssignment(input.assigneeId, input.title);
      return created;
    },
    [projectId, createTaskMut, set, dispatch, user, announceAssignment]
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
    async (
      taskId: number,
      input: Partial<{ title: string; assigneeId: number | null; dueDate: string | null }>,
      ctx?: { title?: string; prevAssigneeId?: number | null }
    ) => {
      if (projectId == null) return;
      await updateTaskMut({ projectId, taskId, input }).unwrap();
      dispatch(addActivity({ projectId, kind: 'updated', message: 'updated a task', at: now() }));
      // Only when this update actually (re)assigns the task to a different member.
      if (input.assigneeId != null && input.assigneeId !== ctx?.prevAssigneeId) {
        announceAssignment(input.assigneeId, ctx?.title ?? 'a task');
      }
    },
    [projectId, updateTaskMut, dispatch, announceAssignment]
  );

  const deleteTask = useCallback(
    async (taskId: number, title?: string, assigneeId?: number | null) => {
      if (projectId == null) return;
      await deleteTaskMut({ projectId, taskId }).unwrap();
      dispatch(addActivity({ projectId, kind: 'deleted', message: `deleted ${title ? `“${title}”` : 'a task'}`, at: now() }));
      if (user) dispatch(logAudit({ actorId: user.id, action: 'task.delete', target: title ?? String(taskId), at: now() }));
      notifyMember(
        assigneeId,
        'warning',
        'Task deleted',
        `${user?.name ?? 'Someone'} deleted “${title ?? 'a task'}” that was assigned to you`
      );
    },
    [projectId, deleteTaskMut, dispatch, user, notifyMember]
  );

  return { projectId, createTask, moveToStatus, updateTask, deleteTask };
}
