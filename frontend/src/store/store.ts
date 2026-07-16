import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import type { Storage } from 'redux-persist';
import defaultStorage from 'redux-persist/lib/storage';

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
import presenceReducer from './slices/presenceSlice';
import orgReducer from './slices/orgSlice';
import sessionReducer from './slices/sessionSlice';

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

const PERSIST_VERSION = 1;

// ui keeps only the durable rail state; transient fields reset each session.
const uiPersisted = persistReducer(
  { key: 'ui', version: PERSIST_VERSION, storage, whitelist: ['sidebarCollapsed', 'favorites'] },
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
  presence: presenceReducer,
  org: orgReducer,
  session: sessionReducer,
});

const persistedRootReducer = persistReducer(
  {
    key: 'kuberya-root',
    version: PERSIST_VERSION,
    storage,
    whitelist: [
      'hierarchy',
      'statuses',
      'tasks',
      'comments',
      'chat',
      'org',
      'notifications',
      'activity',
    ],
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
