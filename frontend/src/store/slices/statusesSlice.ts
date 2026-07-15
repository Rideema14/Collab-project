import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { StatusDef, StatusGroup, StatusSet } from '@/lib/domain/types';
import { defaultStatusSet } from '@/lib/domain/defaults';
import { DEFAULT_STATUS_SET_ID } from './hierarchySlice';

/**
 * Custom statuses — the "do NOT hardcode Todo / In Progress / Done" requirement.
 *
 * Statuses are grouped into named Status Sets (a space picks a set). Users can
 * create, rename, recolor, reorder, and delete statuses freely. The board renders
 * exactly what a set contains — there is no hardcoded column list anywhere.
 *
 * A status may map to a backend enum value (`backendStatus`); moving a task into
 * such a status also PATCHes the server. Statuses with `backendStatus: null` are
 * client-only and persist locally.
 */
export interface StatusesState {
  sets: Record<string, StatusSet>;
}

const initialState: StatusesState = {
  sets: { [DEFAULT_STATUS_SET_ID]: defaultStatusSet(DEFAULT_STATUS_SET_ID) },
};

function reindex(statuses: StatusDef[]) {
  statuses
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((s, i) => {
      s.order = i;
    });
}

const statusesSlice = createSlice({
  name: 'statuses',
  initialState,
  reducers: {
    createStatusSet: {
      reducer(state, action: PayloadAction<StatusSet>) {
        state.sets[action.payload.id] = action.payload;
      },
      prepare(name: string) {
        const id = `set-${nanoid(6)}`;
        return { payload: { ...defaultStatusSet(id), name } satisfies StatusSet };
      },
    },
    /**
     * Fork a per-project (per-list) status set. Clones the source set's statuses —
     * keeping the same NAMES (so existing backend tasks stay mapped) but with fresh
     * ids — into a new set. Idempotent: does nothing if `newSetId` already exists.
     * This is what makes statuses per-project: editing one list's set never touches
     * another's.
     */
    cloneSetForList(
      state,
      action: PayloadAction<{ newSetId: string; sourceSetId: string; name?: string }>
    ) {
      const { newSetId, sourceSetId, name } = action.payload;
      if (state.sets[newSetId]) return;
      const source = state.sets[sourceSetId] ?? state.sets[DEFAULT_STATUS_SET_ID];
      if (!source) return;
      state.sets[newSetId] = {
        id: newSetId,
        name: name ?? source.name,
        statuses: source.statuses
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({ ...s, id: `st-${nanoid(6)}`, order: i })),
      };
    },
    addStatus: {
      reducer(state, action: PayloadAction<{ setId: string; status: StatusDef }>) {
        const set = state.sets[action.payload.setId];
        if (!set) return;
        set.statuses.push(action.payload.status);
        reindex(set.statuses);
      },
      prepare(input: { setId: string; name: string; hue: number; group: StatusGroup }) {
        return {
          payload: {
            setId: input.setId,
            status: {
              id: `st-${nanoid(6)}`,
              name: input.name.trim() || 'New status',
              hue: input.hue,
              group: input.group,
              order: 999,
              backendStatus: null,
            } satisfies StatusDef,
          },
        };
      },
    },
    updateStatus(
      state,
      action: PayloadAction<{ setId: string; statusId: string; changes: Partial<StatusDef> }>
    ) {
      const set = state.sets[action.payload.setId];
      const st = set?.statuses.find((s) => s.id === action.payload.statusId);
      if (st) Object.assign(st, action.payload.changes);
    },
    removeStatus(state, action: PayloadAction<{ setId: string; statusId: string }>) {
      const set = state.sets[action.payload.setId];
      if (!set) return;
      // Never allow deleting the last status — a board needs at least one column.
      if (set.statuses.length <= 1) return;
      set.statuses = set.statuses.filter((s) => s.id !== action.payload.statusId);
      reindex(set.statuses);
    },
    /** Reorder a status to a new index (drag-and-drop in the status manager / board). */
    reorderStatus(state, action: PayloadAction<{ setId: string; statusId: string; toIndex: number }>) {
      const set = state.sets[action.payload.setId];
      if (!set) return;
      const ordered = set.statuses.slice().sort((a, b) => a.order - b.order);
      const from = ordered.findIndex((s) => s.id === action.payload.statusId);
      if (from === -1) return;
      const [moved] = ordered.splice(from, 1);
      const to = Math.max(0, Math.min(action.payload.toIndex, ordered.length));
      ordered.splice(to, 0, moved);
      ordered.forEach((s, i) => {
        s.order = i;
      });
    },
  },
});

export const {
  createStatusSet,
  cloneSetForList,
  addStatus,
  updateStatus,
  removeStatus,
  reorderStatus,
} = statusesSlice.actions;

export default statusesSlice.reducer;
