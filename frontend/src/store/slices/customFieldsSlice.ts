import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Client-only Custom Fields (ClickUp-style). Field DEFINITIONS are scoped to a
 * list; VALUES are keyed by task id + field id. Persisted with the rest of the
 * client domain. Rendered as Table columns and in the task drawer.
 */
export type CustomFieldType = 'text' | 'number' | 'dropdown' | 'date' | 'checkbox' | 'money' | 'rating';

export interface CustomFieldOption {
  id: string;
  label: string;
  hue: number;
}

export interface CustomFieldDef {
  id: string;
  listId: string;
  name: string;
  type: CustomFieldType;
  options: CustomFieldOption[];
  order: number;
}

export type CustomFieldValue = string | number | boolean | null;

export interface CustomFieldsState {
  defs: CustomFieldDef[];
  /** values[taskId][fieldId] */
  values: Record<number, Record<string, CustomFieldValue>>;
}

const initialState: CustomFieldsState = { defs: [], values: {} };

const customFieldsSlice = createSlice({
  name: 'customFields',
  initialState,
  reducers: {
    addField: {
      reducer(state, action: PayloadAction<CustomFieldDef>) {
        state.defs.push(action.payload);
      },
      prepare(input: { listId: string; name: string; type: CustomFieldType; options?: CustomFieldOption[] }) {
        return {
          payload: {
            id: `cf-${nanoid(6)}`,
            listId: input.listId,
            name: input.name.trim() || 'Field',
            type: input.type,
            options: input.options ?? [],
            order: 999,
          } satisfies CustomFieldDef,
        };
      },
    },
    updateField(state, action: PayloadAction<{ id: string; changes: Partial<CustomFieldDef> }>) {
      const f = state.defs.find((x) => x.id === action.payload.id);
      if (f) Object.assign(f, action.payload.changes);
    },
    addFieldOption: {
      reducer(state, action: PayloadAction<{ fieldId: string; option: CustomFieldOption }>) {
        state.defs.find((f) => f.id === action.payload.fieldId)?.options.push(action.payload.option);
      },
      prepare(input: { fieldId: string; label: string; hue: number }) {
        return { payload: { fieldId: input.fieldId, option: { id: `op-${nanoid(5)}`, label: input.label.trim(), hue: input.hue } } };
      },
    },
    removeField(state, action: PayloadAction<string>) {
      state.defs = state.defs.filter((f) => f.id !== action.payload);
      for (const taskId of Object.keys(state.values)) delete state.values[Number(taskId)][action.payload];
    },
    setValue(state, action: PayloadAction<{ taskId: number; fieldId: string; value: CustomFieldValue }>) {
      (state.values[action.payload.taskId] ??= {})[action.payload.fieldId] = action.payload.value;
    },
  },
});

export const { addField, updateField, addFieldOption, removeField, setValue } = customFieldsSlice.actions;
export default customFieldsSlice.reducer;
