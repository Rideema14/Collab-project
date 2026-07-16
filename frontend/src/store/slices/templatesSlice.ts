import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { Priority } from '@/lib/domain/types';

/**
 * Client-only Task and List/Project templates. A task template captures a task's
 * shape (title, priority, subtasks, checklists, tags); a list template captures a
 * set of seed tasks. Applied via useTemplateActions.
 */
export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  priority: Priority;
  subtasks: string[];
  checklists: { name: string; items: string[] }[];
  tagIds: string[];
  createdAt: string;
}

export interface ListTemplateTask {
  title: string;
  status?: string;
  priority?: Priority;
}

export interface ListTemplate {
  id: string;
  name: string;
  tasks: ListTemplateTask[];
  createdAt: string;
}

export interface TemplatesState {
  taskTemplates: TaskTemplate[];
  listTemplates: ListTemplate[];
}

const initialState: TemplatesState = { taskTemplates: [], listTemplates: [] };

const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    addTaskTemplate: {
      reducer(state, action: PayloadAction<TaskTemplate>) {
        state.taskTemplates.unshift(action.payload);
      },
      prepare(input: Omit<TaskTemplate, 'id' | 'createdAt'>) {
        return { payload: { ...input, id: `tt-${nanoid(6)}`, createdAt: new Date().toISOString() } satisfies TaskTemplate };
      },
    },
    removeTaskTemplate(state, action: PayloadAction<string>) {
      state.taskTemplates = state.taskTemplates.filter((t) => t.id !== action.payload);
    },
    addListTemplate: {
      reducer(state, action: PayloadAction<ListTemplate>) {
        state.listTemplates.unshift(action.payload);
      },
      prepare(input: Omit<ListTemplate, 'id' | 'createdAt'>) {
        return { payload: { ...input, id: `lt-${nanoid(6)}`, createdAt: new Date().toISOString() } satisfies ListTemplate };
      },
    },
    removeListTemplate(state, action: PayloadAction<string>) {
      state.listTemplates = state.listTemplates.filter((t) => t.id !== action.payload);
    },
  },
});

export const { addTaskTemplate, removeTaskTemplate, addListTemplate, removeListTemplate } = templatesSlice.actions;
export default templatesSlice.reducer;
