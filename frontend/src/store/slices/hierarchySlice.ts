import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { Folder, List, Space, Workspace } from '@/lib/domain/types';
import type { Project } from '@/lib/types';

/**
 * The client-side Workspace → Space → Folder → List hierarchy.
 *
 * Lists mirror backend projects: `reconcileLists` folds the authoritative project
 * list from the server into the tree, creating a List for any project that doesn't
 * have one yet (placed in the default space) and dropping Lists whose project was
 * deleted. Spaces and folders are purely client-side organization above that.
 */
export interface HierarchyState {
  workspaces: Workspace[];
  spaces: Space[];
  folders: Folder[];
  lists: List[];
  activeWorkspaceId: string;
  /** Tree expand/collapse state, keyed by node id. */
  expanded: Record<string, boolean>;
}

export const DEFAULT_WORKSPACE_ID = 'ws-default';
export const DEFAULT_SPACE_ID = 'space-default';
export const DEFAULT_STATUS_SET_ID = 'set-default';

const initialState: HierarchyState = {
  workspaces: [
    { id: DEFAULT_WORKSPACE_ID, name: 'Kuberya', hue: 211, createdAt: '1970-01-01T00:00:00.000Z' },
  ],
  spaces: [
    {
      id: DEFAULT_SPACE_ID,
      workspaceId: DEFAULT_WORKSPACE_ID,
      name: 'Product',
      icon: '🚀',
      hue: 262,
      statusSetId: DEFAULT_STATUS_SET_ID,
      order: 0,
      createdAt: '1970-01-01T00:00:00.000Z',
    },
  ],
  folders: [],
  lists: [],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  expanded: { [DEFAULT_SPACE_ID]: true },
};

const hierarchySlice = createSlice({
  name: 'hierarchy',
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
      prepare(input: { name: string; createdAt: string }) {
        return {
          payload: {
            id: `ws-${nanoid(6)}`,
            name: input.name.trim(),
            hue: Math.abs(hash(input.name)) % 360,
            createdAt: input.createdAt,
          } satisfies Workspace,
        };
      },
    },
    addSpace: {
      reducer(state, action: PayloadAction<Space>) {
        state.spaces.push(action.payload);
        state.expanded[action.payload.id] = true;
      },
      prepare(input: { workspaceId: string; name: string; icon?: string; statusSetId: string; createdAt: string }) {
        return {
          payload: {
            id: `space-${nanoid(6)}`,
            workspaceId: input.workspaceId,
            name: input.name.trim(),
            icon: input.icon ?? '📦',
            hue: Math.abs(hash(input.name)) % 360,
            statusSetId: input.statusSetId,
            order: 999,
            createdAt: input.createdAt,
          } satisfies Space,
        };
      },
    },
    updateSpace(state, action: PayloadAction<{ id: string; changes: Partial<Space> }>) {
      const s = state.spaces.find((x) => x.id === action.payload.id);
      if (s) Object.assign(s, action.payload.changes);
    },
    addFolder: {
      reducer(state, action: PayloadAction<Folder>) {
        state.folders.push(action.payload);
        state.expanded[action.payload.id] = true;
      },
      prepare(input: { spaceId: string; name: string; createdAt: string }) {
        return {
          payload: {
            id: `folder-${nanoid(6)}`,
            spaceId: input.spaceId,
            name: input.name.trim(),
            order: 999,
            createdAt: input.createdAt,
          } satisfies Folder,
        };
      },
    },
    /** Attach a client List to an existing backend project id. */
    addList: {
      reducer(state, action: PayloadAction<List>) {
        state.lists.push(action.payload);
      },
      prepare(input: {
        backendProjectId: number;
        spaceId: string;
        folderId?: string | null;
        name: string;
        createdAt: string;
      }) {
        return {
          payload: {
            id: `list-${nanoid(6)}`,
            backendProjectId: input.backendProjectId,
            spaceId: input.spaceId,
            folderId: input.folderId ?? null,
            name: input.name.trim(),
            order: 999,
            createdAt: input.createdAt,
          } satisfies List,
        };
      },
    },
    /** Point a list at its own (per-project) status set. See statusesSlice.cloneSetForList. */
    assignListStatusSet(state, action: PayloadAction<{ listId: string; statusSetId: string }>) {
      const list = state.lists.find((l) => l.id === action.payload.listId);
      if (list) list.statusSetId = action.payload.statusSetId;
    },
    moveList(state, action: PayloadAction<{ listId: string; spaceId: string; folderId: string | null }>) {
      const list = state.lists.find((l) => l.id === action.payload.listId);
      if (list) {
        list.spaceId = action.payload.spaceId;
        list.folderId = action.payload.folderId;
      }
    },
    toggleExpanded(state, action: PayloadAction<string>) {
      state.expanded[action.payload] = !state.expanded[action.payload];
    },
    /**
     * Fold the authoritative backend project list into the tree. Creates a List
     * for any new project (in the default space) and prunes Lists whose project
     * no longer exists. Never touches user-arranged placement of existing lists.
     */
    reconcileLists(
      state,
      action: PayloadAction<{ projects: Project[]; defaultSpaceId: string; createdAt: string }>
    ) {
      const { projects, defaultSpaceId, createdAt } = action.payload;
      const known = new Set(state.lists.map((l) => l.backendProjectId));
      const live = new Set(projects.map((p) => p.id));

      for (const p of projects) {
        if (!known.has(p.id)) {
          state.lists.push({
            id: `list-${p.id}`,
            backendProjectId: p.id,
            spaceId: defaultSpaceId,
            folderId: null,
            name: p.name ?? `Project ${p.id}`,
            order: state.lists.length,
            createdAt,
          });
        } else {
          // Keep the name in sync with the server.
          const existing = state.lists.find((l) => l.backendProjectId === p.id);
          if (existing && p.name) existing.name = p.name;
        }
      }
      state.lists = state.lists.filter((l) => live.has(l.backendProjectId));
    },
  },
});

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export const {
  setActiveWorkspace,
  addWorkspace,
  addSpace,
  updateSpace,
  addFolder,
  addList,
  assignListStatusSet,
  moveList,
  toggleExpanded,
  reconcileLists,
} = hierarchySlice.actions;

export default hierarchySlice.reducer;
