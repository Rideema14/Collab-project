import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { createMigrate, persistReducer, persistStore } from 'redux-persist';
import type { PersistedState, Storage } from 'redux-persist';
import defaultStorage from 'redux-persist/lib/storage';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';
import type { MemberMeta, Role } from '@/lib/domain/types';

import { backendApi } from './api/backendApi';
import { createSocketMiddleware } from './middleware/socketMiddleware';

import uiReducer from './slices/uiSlice';
import notificationsReducer from './slices/notificationsSlice';
import activityReducer from './slices/activitySlice';
import hierarchyReducer from './slices/hierarchySlice';
import statusesReducer from './slices/statusesSlice';
import tasksReducer from './slices/tasksSlice';
import commentsReducer from './slices/commentsSlice';
import chatReducer from './slices/chatSlice';
import aiReducer from './slices/aiSlice';
import customFieldsReducer from './slices/customFieldsSlice';
import timeReducer from './slices/timeSlice';
import templatesReducer from './slices/templatesSlice';
import dashboardReducer from './slices/dashboardSlice';
import presenceReducer from './slices/presenceSlice';
import orgReducer from './slices/orgSlice';
import sessionReducer from './slices/sessionSlice';
import sprintsReducer from './slices/sprintsSlice';

/**
 * Redux store: RTK Query (`backendApi`) for the real server, Redux Persist for the
 * client-owned domain, and socket middleware for realtime.
 *
 * PERSISTED (client is source of truth): hierarchy, statuses, tasks(rich+prefs),
 * comments, org, workspace, notifications, activity, and ui.sidebarCollapsed.
 * NOT persisted: backendApi cache (refetched), presence (ephemeral), session
 * (derived from the auth token), and transient ui (open panels/drawers).
 */

// On the server there is no localStorage; use a noop so persistReducer is safe to
// build during SSR. Real persistence happens only in the browser.
const noopStorage: Storage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};
const storage: Storage = typeof window !== 'undefined' ? defaultStorage : noopStorage;

const UI_PERSIST_VERSION = 1;

// v2 removed the Owner role, leaving Admin as the only privileged role.
const ROOT_PERSIST_VERSION = 2;

/**
 * Typed structurally rather than via RootState: RootState is derived from the
 * store that this config builds, so referring to it here makes the inference
 * circular and TS silently degrades RootState to `any`.
 */
type PersistedRoot = PersistedState & {
  org?: { roles?: Role[]; members?: Record<number, MemberMeta> };
};

/**
 * The `org` slice is persisted and restored over the defaults — so without this,
 * an existing session keeps its Owner role, which no longer resolves to anything
 * and would lock the workspace's admin out of the panel they own. Rewrite Owner
 * to Admin (its permissions are now identical).
 */
const migrations = {
  2: (state: PersistedState) => {
    const s = state as PersistedRoot | undefined;
    // A blob missing these isn't safely migratable, and a migration that THROWS
    // rejects rehydration entirely — silently dropping the whole workspace.
    if (!s?.org?.roles || !s.org.members) return state;
    return {
      ...s,
      org: {
        ...s.org,
        roles: s.org.roles.filter((r) => r.id !== 'role-owner'),
        members: Object.fromEntries(
          Object.entries(s.org.members).map(([id, m]) => [
            id,
            m.roleId === 'role-owner' ? { ...m, roleId: 'role-admin' } : m,
          ])
        ),
      },
    } as PersistedState;
  },
};

/**
 * Redux Persist writes by running JSON.stringify over the whole persisted subtree
 * SYNCHRONOUSLY on the main thread. Its default throttle is 0 — i.e. once per
 * dispatch — so every keystroke re-serialized the entire workspace and made typing
 * feel laggy. Batching writes to once per second is imperceptible for durability
 * (a reload is orders of magnitude slower than 1s) and removes that work from the
 * interaction path.
 */
const PERSIST_THROTTLE_MS = 1000;

// ui keeps only the durable rail state; transient fields reset each session.
const uiPersisted = persistReducer(
  {
    key: 'ui',
    version: UI_PERSIST_VERSION,
    storage,
    throttle: PERSIST_THROTTLE_MS,
    whitelist: ['sidebarCollapsed', 'favorites'],
  },
  uiReducer
);

const rootReducer = combineReducers({
  [backendApi.reducerPath]: backendApi.reducer,
  ui: uiPersisted,
  notifications: notificationsReducer,
  activity: activityReducer,
  hierarchy: hierarchyReducer,
  statuses: statusesReducer,
  tasks: tasksReducer,
  comments: commentsReducer,
  chat: chatReducer,
  ai: aiReducer,
  customFields: customFieldsReducer,
  time: timeReducer,
  templates: templatesReducer,
  dashboard: dashboardReducer,
  presence: presenceReducer,
  org: orgReducer,
  session: sessionReducer,
  sprints: sprintsReducer,
});

// autoMergeLevel2 is generic, which defeats persistReducer's inference of the
// state type from the config and silently degrades RootState to `any`. Pin the
// type argument explicitly so the whole store stays typed.
type RootReducerState = ReturnType<typeof rootReducer>;

const persistedRootReducer = persistReducer<RootReducerState>(
  {
    key: 'kuberya-root',
    version: ROOT_PERSIST_VERSION,
    storage,
    throttle: PERSIST_THROTTLE_MS,
    migrate: createMigrate(migrations),
    // The default (autoMergeLevel1) restores each slice WHOLESALE, so any field
    // added to an already-persisted slice is simply absent for existing users —
    // `org.teams` arrived after the first blobs were written, and Admin → Teams
    // crashed on `undefined.length`. Level 2 shallow-merges each slice over its
    // initialState, so new fields keep their defaults while stored fields still
    // win. Unlike a migration this runs on every rehydrate, so it also repairs
    // blobs already written at the current version.
    stateReconciler: autoMergeLevel2,
    whitelist: [
      'hierarchy',
      'statuses',
      'tasks',
      'comments',
      'chat',
      'org',
      'notifications',
      'activity',
      'customFields',
      'time',
      'templates',
      'dashboard',
      'sprints',
    ],
    // A failed write (usually localStorage's ~5MB quota) otherwise fails silently
    // and every later save is lost too — the user only finds out when a reload
    // drops their work. Surface it so the cause is diagnosable.
    writeFailHandler: (err) =>
      console.error('[persist] Could not save workspace to localStorage — changes this session may not survive a reload.', err),
  },
  rootReducer
);

export function makeStore() {
  const store = configureStore({
    reducer: persistedRootReducer,
    middleware: (getDefault) =>
      getDefault({
        // The dev-only immutability check deep-scans the whole tree on EVERY
        // dispatch. With the RTK Query cache plus a 4s presence heartbeat that
        // froze the UI for seconds at a time. Both checks are dev-only and cost
        // real time on a store this size, so disable them (RTK's own recommendation
        // for large RTK Query + redux-persist stores).
        immutableCheck: false,
        serializableCheck: false,
      })
        .concat(backendApi.middleware)
        .concat(createSocketMiddleware()),
  });

  return store;
}

export function makePersistor(store: AppStore) {
  return persistStore(store);
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
