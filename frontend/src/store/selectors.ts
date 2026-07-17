import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';
import type { Permission, StatusSet } from '@/lib/domain/types';
import type { CustomFieldDef } from './slices/customFieldsSlice';
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
export const selectFavorites = (s: RootState) => s.ui.favorites;
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
export const selectTeams = (s: RootState) => s.org.teams;

const EMPTY_SPRINTS: import('@/lib/domain/types').SprintDef[] = [];
export const selectSprintsForList = (listId: string) => (s: RootState) =>
  s.sprints.byList[listId] ?? EMPTY_SPRINTS;

export const selectSavedViewsForList = (listId: string) => (s: RootState) =>
  s.tasks.savedViews.filter((v) => v.listId === listId);

/**
 * Permissions granted to the signed-in user by their role — empty when signed
 * out or not yet in the member roster. UI-level only (see orgSlice).
 */
export const selectMyPermissions = createSelector(
  [(s: RootState) => s.session.user, selectMembersMeta, selectRoles],
  (user, members, roles): Permission[] => {
    if (!user) return [];
    const roleId = members[user.id]?.roleId;
    return roles.find((r) => r.id === roleId)?.permissions ?? [];
  }
);

// --- custom fields ---
export const selectCustomFieldDefs = (s: RootState) => s.customFields.defs;
/**
 * This list's fields, in order. Cached per listId for the same reason as
 * selectStatusSetForList: filter+sort builds a NEW array every call, so an
 * uncached selector hands useAppSelector a fresh reference after every dispatch
 * and re-renders the table/drawer on unrelated state (e.g. the presence
 * heartbeat). One memoized selector per list makes those dispatches O(1) no-ops.
 */
const fieldsForListCache = new Map<string, (state: RootState) => CustomFieldDef[]>();
export const selectFieldsForList = (listId: string): ((state: RootState) => CustomFieldDef[]) => {
  let selector = fieldsForListCache.get(listId);
  if (!selector) {
    selector = createSelector([selectCustomFieldDefs], (defs) =>
      defs.filter((f) => f.listId === listId).sort((a, b) => a.order - b.order)
    );
    fieldsForListCache.set(listId, selector);
  }
  return selector;
};
export const selectFieldValues = (taskId: number) => (s: RootState) => s.customFields.values[taskId] ?? EMPTY_VALUES;
const EMPTY_VALUES: Record<string, never> = {};

// --- time tracking ---
export const selectTimeEntries = (s: RootState) => s.time.entries;
export const selectRunningTimer = (s: RootState) => s.time.running;
export const selectTimeForTask = (taskId: number) => (s: RootState) =>
  s.time.entries.filter((e) => e.taskId === taskId).reduce((sum, e) => sum + e.minutes, 0);

// --- templates ---
export const selectTaskTemplates = (s: RootState) => s.templates.taskTemplates;
export const selectListTemplates = (s: RootState) => s.templates.listTemplates;

// --- dashboard ---
export const selectWidgets = (s: RootState) => s.dashboard.widgets;

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

// --- ai ---
export const selectAiMessages = (s: RootState) => s.ai.messages;
export const selectAiActionHistory = (s: RootState) => s.ai.actionHistory;
export const selectAiPending = (s: RootState) => s.ai.pending;
export const selectAiBusy = (s: RootState) => s.ai.busy;
export const selectAiOpen = (s: RootState) => s.ai.open;

// --- chat ---
export const selectChatChannels = (s: RootState) => s.chat.channels;
export const selectActiveChannelId = (s: RootState) => s.chat.activeChannelId;
export const selectChatMessages = (channelId: string) => (s: RootState) =>
  s.chat.messagesByChannel[channelId] ?? EMPTY_MESSAGES;
const EMPTY_MESSAGES: [] = [];
