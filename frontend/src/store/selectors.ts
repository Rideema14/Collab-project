import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';
import type { StatusSet } from '@/lib/domain/types';
import { DEFAULT_STATUS_SET_ID } from './slices/hierarchySlice';

// --- ui ---
export const selectSidebarCollapsed = (s: RootState) => s.ui.sidebarCollapsed;
export const selectMobileSidebarOpen = (s: RootState) => s.ui.mobileSidebarOpen;
export const selectCommandPaletteOpen = (s: RootState) => s.ui.commandPaletteOpen;
export const selectOpenTaskId = (s: RootState) => s.ui.openTaskId;

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
/**
 * Resolve the status set that applies to a list (list override → space → default).
 *
 * Cached per listId: a bare factory would build a NEW memoized selector on every
 * render, defeating memoization and recomputing on each call (this runs in every
 * board render via useListData/useTaskVM/useStatusActions). One selector per list
 * keeps the reselect cache warm so unrelated state changes are O(1) no-ops.
 */
const statusSetForListCache = new Map<string, (state: RootState) => StatusSet>();
export const selectStatusSetForList = (listId: string): ((state: RootState) => StatusSet) => {
  let selector = statusSetForListCache.get(listId);
  if (!selector) {
    selector = createSelector(
      [selectStatusSets, selectLists, (s: RootState) => s.hierarchy.spaces],
      (sets, lists, spaces) => {
        const list = lists.find((l) => l.id === listId);
        const space = list ? spaces.find((sp) => sp.id === list.spaceId) : null;
        const setId = list?.statusSetId ?? space?.statusSetId ?? DEFAULT_STATUS_SET_ID;
        return sets[setId] ?? sets[DEFAULT_STATUS_SET_ID];
      }
    );
    statusSetForListCache.set(listId, selector);
  }
  return selector;
};

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
