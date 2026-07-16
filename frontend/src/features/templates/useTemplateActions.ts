'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppStore } from '@/store/hooks';
import {
  backendApi,
  useCreateProjectMutation,
  useCreateTaskMutation,
} from '@/store/api/backendApi';
import { addList, DEFAULT_SPACE_ID } from '@/store/slices/hierarchySlice';
import {
  addChecklist,
  addChecklistItem,
  addSubtask,
  setPriority,
  setTags,
} from '@/store/slices/tasksSlice';
import { addTaskTemplate, addListTemplate, type ListTemplate, type TaskTemplate } from '@/store/slices/templatesSlice';
import type { RootState } from '@/store/store';

/** Save-to / apply-from template actions, built on the existing task/project APIs. */
export function useTemplateActions() {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [createProject] = useCreateProjectMutation();
  const [createTask] = useCreateTaskMutation();
  const state = () => store.getState() as RootState;

  const saveTaskAsTemplate = useCallback(
    (taskId: number, title: string, name: string) => {
      const rich = state().tasks.richById[taskId];
      dispatch(
        addTaskTemplate({
          name,
          title,
          priority: rich?.priority ?? 'none',
          subtasks: (rich?.subtasks ?? []).map((s) => s.title),
          checklists: (rich?.checklists ?? []).map((c) => ({ name: c.name, items: c.items.map((i) => i.text) })),
          tagIds: rich?.tagIds ?? [],
        })
      );
    },
    [dispatch, store]
  );

  const applyTaskTemplate = useCallback(
    async (t: TaskTemplate, listId: string) => {
      const list = state().hierarchy.lists.find((l) => l.id === listId);
      if (!list) return;
      const created = await createTask({ projectId: list.backendProjectId, title: t.title, assigneeId: null, dueDate: null }).unwrap();
      dispatch(setPriority({ taskId: created.id, priority: t.priority }));
      t.subtasks.forEach((title) => dispatch(addSubtask({ taskId: created.id, title })));
      t.checklists.forEach((cl) => {
        const act = dispatch(addChecklist({ taskId: created.id, name: cl.name }));
        cl.items.forEach((text) => dispatch(addChecklistItem({ taskId: created.id, checklistId: act.payload.checklist.id, text })));
      });
      if (t.tagIds.length) dispatch(setTags({ taskId: created.id, tagIds: t.tagIds }));
      return created;
    },
    [createTask, dispatch, store]
  );

  const saveListAsTemplate = useCallback(
    async (listId: string, name: string) => {
      const list = state().hierarchy.lists.find((l) => l.id === listId);
      if (!list) return;
      const sub = store.dispatch(backendApi.endpoints.getBoard.initiate(list.backendProjectId));
      try {
        const board = await sub.unwrap();
        const tasks = Object.values(board)
          .flat()
          .map((t) => ({ title: t.title, status: t.status }));
        dispatch(addListTemplate({ name, tasks }));
      } finally {
        sub.unsubscribe();
      }
    },
    [dispatch, store]
  );

  const applyListTemplate = useCallback(
    async (t: ListTemplate) => {
      const project = await createProject({ name: t.name }).unwrap();
      const spaceId = state().hierarchy.spaces[0]?.id ?? DEFAULT_SPACE_ID;
      const act = dispatch(addList({ backendProjectId: project.id, spaceId, folderId: null, name: t.name, createdAt: new Date().toISOString() }));
      for (const tk of t.tasks) {
        await createTask({ projectId: project.id, title: tk.title, assigneeId: null, dueDate: null, status: tk.status }).unwrap().catch(() => {});
      }
      router.push(`/list/${act.payload.id}`);
    },
    [createProject, createTask, dispatch, router, store]
  );

  return { saveTaskAsTemplate, applyTaskTemplate, saveListAsTemplate, applyListTemplate };
}
