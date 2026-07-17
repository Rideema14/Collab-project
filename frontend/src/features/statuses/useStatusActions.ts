'use client';

import { useCallback, useEffect } from 'react';
import { useGetBoardQuery, useUpdateTaskStatusMutation } from '@/store/api/backendApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectListById, selectStatusSetForList, selectStatusSets } from '@/store/selectors';
import { assignListStatusSet } from '@/store/slices/hierarchySlice';
import {
  addStatus,
  cloneSetForList,
  removeStatus,
  reorderStatus,
  updateStatus,
} from '@/store/slices/statusesSlice';
import type { StatusGroup, StatusSet } from '@/lib/domain/types';

/**
 * All status mutations for a single list (= backend project), with two concerns
 * the raw slice can't handle alone:
 *
 *  1. PER-PROJECT sets — the first time a list's status manager opens, the list
 *     forks its own set (cloned by NAME so existing tasks stay mapped). After that,
 *     editing this list's statuses never touches any other project.
 *
 *  2. TASK MIGRATION — renaming or deleting a status must keep existing tasks
 *     working. Backend task status is a free string NAME (the source of truth), so
 *     a rename PATCHes every task in the old column to the new name, and a delete
 *     reassigns its tasks to the first remaining status. Nothing is orphaned.
 */
export function useStatusActions(listId: string) {
  const dispatch = useAppDispatch();
  const list = useAppSelector(selectListById(listId));
  const resolved = useAppSelector(selectStatusSetForList(listId));
  const sets = useAppSelector(selectStatusSets);
  const projectId = list?.backendProjectId ?? null;

  const { data: board } = useGetBoardQuery(projectId as number, { skip: projectId == null });
  const [updateStatusMut] = useUpdateTaskStatusMutation();

  // Deterministic per-list set id, so forking is idempotent across remounts.
  const ownSetId = `set-list-${listId}`;
  const setId = list?.statusSetId ?? ownSetId;
  const set: StatusSet = sets[setId] ?? resolved;

  // Fork-on-open: fork BEFORE the user can edit, so every row already carries this
  // list's own status ids (avoids editing ids that belong to the shared set).
  useEffect(() => {
    if (list && !list.statusSetId) {
      dispatch(cloneSetForList({ newSetId: ownSetId, sourceSetId: resolved.id, name: list.name }));
      dispatch(assignListStatusSet({ listId, statusSetId: ownSetId }));
    }
  }, [dispatch, listId, list, ownSetId, resolved.id]);

  /** Re-point every backend task currently in `fromName` to `toName`. */
  const migrateTasks = useCallback(
    async (fromName: string, toName: string) => {
      if (projectId == null || !board || fromName === toName) return;
      const tasks = board[fromName] ?? [];
      await Promise.all(
        tasks.map((t) =>
          updateStatusMut({ projectId, taskId: t.id, status: toName }).unwrap().catch(() => {})
        )
      );
    },
    [projectId, board, updateStatusMut]
  );

  const addNew = useCallback(
    (name: string, hue: number, group: StatusGroup) => {
      dispatch(addStatus({ setId, name, hue, group }));
    },
    [dispatch, setId]
  );

  const recolor = useCallback(
    (statusId: string, hue: number) => dispatch(updateStatus({ setId, statusId, changes: { hue } })),
    [dispatch, setId]
  );

  const regroup = useCallback(
    (statusId: string, group: StatusGroup) =>
      dispatch(updateStatus({ setId, statusId, changes: { group } })),
    [dispatch, setId]
  );

  const setWipLimit = useCallback(
    (statusId: string, wipLimit: number | null) =>
      dispatch(updateStatus({ setId, statusId, changes: { wipLimit } })),
    [dispatch, setId]
  );

  const reorder = useCallback(
    (statusId: string, toIndex: number) => dispatch(reorderStatus({ setId, statusId, toIndex })),
    [dispatch, setId]
  );

  /** Rename a status and migrate its tasks so the column keeps its contents. */
  const rename = useCallback(
    (statusId: string, nextName: string) => {
      const st = set.statuses.find((s) => s.id === statusId);
      if (!st) return;
      const clean = nextName.trim();
      if (!clean || clean === st.name) return;
      dispatch(updateStatus({ setId, statusId, changes: { name: clean } }));
      void migrateTasks(st.name, clean);
    },
    [dispatch, setId, set, migrateTasks]
  );

  /** Archive/un-archive. Refuses to archive the last remaining active status. */
  const setArchived = useCallback(
    (statusId: string, archived: boolean) => {
      if (archived && set.statuses.filter((s) => !s.archived).length <= 1) return;
      dispatch(updateStatus({ setId, statusId, changes: { archived } }));
    },
    [dispatch, setId, set]
  );

  /** Delete a status; its tasks move to the first remaining status so none are lost. */
  const remove = useCallback(
    (statusId: string) => {
      if (set.statuses.length <= 1) return;
      const st = set.statuses.find((s) => s.id === statusId);
      if (!st) return;
      const fallback =
        set.statuses.find((s) => s.id !== statusId && !s.archived) ??
        set.statuses.find((s) => s.id !== statusId);
      if (fallback) void migrateTasks(st.name, fallback.name);
      dispatch(removeStatus({ setId, statusId }));
    },
    [dispatch, setId, set, migrateTasks]
  );

  return { set, setId, addNew, recolor, regroup, reorder, rename, setArchived, setWipLimit, remove };
}
