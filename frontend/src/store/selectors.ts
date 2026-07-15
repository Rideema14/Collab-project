import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { DEFAULT_STATUS_SET_ID } from './slices/hierarchySlice';

// --- ui ---
export const selectSidebarCollapsed = (s: RootState) => s.ui.sidebarCollapsed;
export const selectMobileSidebarOpen = (s: RootState) => s.ui.mobileSidebarOpen;
export const selectCommandPaletteOpen = (s: RootState) => s.ui.commandPaletteOpen;
export const selectOpenTaskId = (s: RootState) => s.ui.openTaskId;

// --- workspace (legacy switcher slice) ---
export const selectWorkspaces = (s: RootState) => s.workspace.workspaces;
export const selectActiveWorkspace = createSelector(
  [selectWorkspaces, (s: RootState) => s.workspace.activeWorkspaceId],
  (workspaces, activeId) => workspaces.find((w) => w.id === activeId) ?? workspaces[0]
);

// --- hierarchy ---
export const selectHierarchy = (s: RootState) => s.hierarchy;
export const selectActiveWorkspaceId = (s: RootState) => s.hierarchy.activeWorkspaceId;
export const selectSpaces = createSelector(
  [(s: RootState) => s.hierarchy.spaces, selectActiveWorkspaceId],
  (spaces, wsId) => spaces.filter((sp) => sp.workspaceId === wsId).sort((a, b) => a.order - b.order)
);
export const selectFolders = (s: RootState) => s.hierarchy.folders;
export const selectLists = (s: RootState) => s.hierarchy.lists;
export const selectExpanded = (s: RootState) => s.hierarchy.expanded;
export const selectListById = (id: string) => (s: RootState) =>
  s.hierarchy.lists.find((l) => l.id === id) ?? null;
export const selectSpaceById = (id: string) => (s: RootState) =>
  s.hierarchy.spaces.find((sp) => sp.id === id) ?? null;

// --- statuses ---
export const selectStatusSets = (s: RootState) => s.statuses.sets;
/** Resolve the status set that applies to a list (list override → space → default). */
export const selectStatusSetForList = (listId: string) =>
  createSelector([selectStatusSets, selectLists, (s: RootState) => s.hierarchy.spaces], (sets, lists, spaces) => {
    const list = lists.find((l) => l.id === listId);
    const space = list ? spaces.find((sp) => sp.id === list.spaceId) : null;
    const setId = list?.statusSetId ?? space?.statusSetId ?? DEFAULT_STATUS_SET_ID;
    return sets[setId] ?? sets[DEFAULT_STATUS_SET_ID];
  });

// --- tasks (rich + prefs) ---
export const selectRichById = (s: RootState) => s.tasks.richById;
export const selectPrefsByList = (s: RootState) => s.tasks.prefsByList;

// --- org ---
export const selectRoles = (s: RootState) => s.org.roles;
export const selectMembersMeta = (s: RootState) => s.org.members;
export const selectTags = (s: RootState) => s.org.tags;
export const selectAudit = (s: RootState) => s.org.audit;

// --- session / presence ---
export const selectSessionUser = (s: RootState) => s.session.user;
export const selectPresencePeers = (s: RootState) => s.presence.peers;
export const selectSelfClientId = (s: RootState) => s.presence.selfClientId;

// --- notifications ---
export const selectNotifications = (s: RootState) => s.notifications.items;
export const selectUnreadCount = createSelector([selectNotifications], (items) =>
  items.reduce((count, n) => (n.read ? count : count + 1), 0)
);

// --- activity ---
export const selectAllActivity = (s: RootState) => s.activity.items;
