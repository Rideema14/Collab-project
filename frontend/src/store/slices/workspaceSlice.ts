import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Workspaces are a CLIENT-SIDE construct.
 *
 * The backend is deliberately single-tenant: one shared team, one shared set of
 * projects, no `workspace` table and no per-workspace scoping (see the backend
 * analysis). Rather than fake server data, this slice gives the shell a real,
 * honest workspace switcher whose state lives in Redux and persists to
 * localStorage. Every workspace currently shows the same shared projects — the
 * switcher is an organizational lens over one team, not a data boundary. If the
 * backend ever grows real tenancy, this slice is the seam to wire it to.
 */
export interface Workspace {
  id: string;
  name: string;
  /** A short accent key so each workspace reads distinctly in the switcher. */
  color: 'primary' | 'success' | 'warning' | 'danger';
}

export interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default',
  name: 'Kuberya',
  color: 'primary',
};

const initialState: WorkspaceState = {
  workspaces: [DEFAULT_WORKSPACE],
  activeWorkspaceId: DEFAULT_WORKSPACE.id,
};

const ACCENTS: Workspace['color'][] = ['primary', 'success', 'warning', 'danger'];

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setActiveWorkspace(state, action: PayloadAction<string>) {
      if (state.workspaces.some((w) => w.id === action.payload)) {
        state.activeWorkspaceId = action.payload;
      }
    },
    addWorkspace: {
      reducer(state, action: PayloadAction<Workspace>) {
        state.workspaces.push(action.payload);
        state.activeWorkspaceId = action.payload.id;
      },
      prepare(name: string) {
        const trimmed = name.trim();
        return {
          payload: {
            id: nanoid(),
            name: trimmed,
            // Rotate through the accents so a new workspace looks distinct.
            color: ACCENTS[Math.abs(hashString(trimmed)) % ACCENTS.length],
          } satisfies Workspace,
        };
      },
    },
    hydrateWorkspace(state, action: PayloadAction<Partial<WorkspaceState>>) {
      const { workspaces, activeWorkspaceId } = action.payload;
      if (Array.isArray(workspaces) && workspaces.length > 0) {
        state.workspaces = workspaces;
      }
      if (activeWorkspaceId && state.workspaces.some((w) => w.id === activeWorkspaceId)) {
        state.activeWorkspaceId = activeWorkspaceId;
      }
    },
  },
});

/** Tiny deterministic string hash — stable colour per name, no Math.random. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export const { setActiveWorkspace, addWorkspace, hydrateWorkspace } = workspaceSlice.actions;

export default workspaceSlice.reducer;
