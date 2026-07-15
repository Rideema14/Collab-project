import type { AppStore, RootState } from './store';
import { hydrateUi } from './slices/uiSlice';
import { hydrateWorkspace } from './slices/workspaceSlice';
import { hydrateNotifications } from './slices/notificationsSlice';
import { hydrateActivity } from './slices/activitySlice';

const STORAGE_KEY = 'kuberya.shell';

/** Only these slices/fields are durable — transient UI (open panels) is not. */
interface PersistedShape {
  ui: { sidebarCollapsed: boolean };
  workspace: Pick<RootState['workspace'], 'workspaces' | 'activeWorkspaceId'>;
  notifications: Pick<RootState['notifications'], 'items'>;
  activity: Pick<RootState['activity'], 'items'>;
}

function readPersisted(): Partial<PersistedShape> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedShape>) : null;
  } catch {
    return null;
  }
}

/**
 * Rehydrate the store on the client after mount. Doing this in an effect (not via
 * preloadedState) means the server and first client render share identical
 * defaults — no hydration mismatch — and persisted values apply one tick later.
 */
export function hydrateStore(store: AppStore): void {
  const persisted = readPersisted();

  if (persisted?.ui) store.dispatch(hydrateUi(persisted.ui));
  if (persisted?.workspace) store.dispatch(hydrateWorkspace(persisted.workspace));
  if (persisted?.activity?.items) store.dispatch(hydrateActivity({ items: persisted.activity.items }));

  if (persisted?.notifications?.items) {
    store.dispatch(hydrateNotifications({ items: persisted.notifications.items }));
  } else {
    // First run: the seeded notifications carry placeholder 1970 timestamps so
    // the reducer stays pure. Stamp them with a real "just now" on the client.
    const now = new Date().toISOString();
    const seeded = store.getState().notifications.items.map((n) => ({ ...n, createdAt: now }));
    store.dispatch(hydrateNotifications({ items: seeded }));
  }
}

/** Subscribe the store to localStorage, writing the durable subset on change. */
export function persistStore(store: AppStore): () => void {
  let last = '';
  return store.subscribe(() => {
    const state = store.getState();
    const snapshot: PersistedShape = {
      ui: { sidebarCollapsed: state.ui.sidebarCollapsed },
      workspace: {
        workspaces: state.workspace.workspaces,
        activeWorkspaceId: state.workspace.activeWorkspaceId,
      },
      notifications: { items: state.notifications.items },
      activity: { items: state.activity.items },
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized === last) return;
    last = serialized;
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // Private-mode / quota failure shouldn't break the app.
    }
  });
}
