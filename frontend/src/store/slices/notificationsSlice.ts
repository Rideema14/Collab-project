import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Notifications are a CLIENT-SIDE construct.
 *
 * The backend has no notifications table or feed. Rather than invent a fake
 * server stream, this slice is a real in-app notification bus: anywhere in the
 * app can `dispatch(pushNotification(...))` when something noteworthy happens
 * (a task created, a move failed, voice capture succeeded), and the Notification
 * Center renders the result with unread tracking that persists across sessions.
 *
 * It ships seeded with a couple of onboarding entries so the centre is never an
 * empty void on first run. When the backend grows a real feed, replace the seed
 * + local pushes with a fetch; the component contract stays the same.
 */
export type NotificationTone = 'info' | 'success' | 'warning';

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  body?: string;
  /** ISO timestamp. Passed in by the dispatcher so this slice stays pure. */
  createdAt: string;
  /** Optional in-app route to open when the notification is clicked. */
  href?: string;
  /** The task this notification is about, if any — lets us drop it when the task is deleted. */
  taskId?: number;
  read: boolean;
}

export interface NotificationsState {
  items: AppNotification[];
}

/**
 * Seed content. Timestamps are relative to a fixed anchor so the reducer never
 * calls Date.now() (keeps it pure/testable); StoreProvider restamps them to
 * real times on hydrate if none are persisted.
 */
const initialState: NotificationsState = {
  items: [
    {
      id: 'seed-welcome',
      tone: 'info',
      title: 'Welcome to your workspace',
      body: 'Press ⌘K anytime to jump to a project or run a command.',
      createdAt: '1970-01-01T00:00:00.000Z',
      read: false,
    },
    {
      id: 'seed-voice',
      tone: 'success',
      title: 'Voice capture is ready',
      body: 'Add a task by voice from any board with “Add by voice”.',
      createdAt: '1970-01-01T00:00:00.000Z',
      read: false,
    },
  ],
};

const MAX_ITEMS = 50;

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    pushNotification: {
      reducer(state, action: PayloadAction<AppNotification>) {
        state.items.unshift(action.payload);
        if (state.items.length > MAX_ITEMS) {
          state.items.length = MAX_ITEMS;
        }
      },
      prepare(input: {
        tone: NotificationTone;
        title: string;
        body?: string;
        href?: string;
        taskId?: number;
        createdAt: string;
      }) {
        return { payload: { id: nanoid(), read: false, ...input } satisfies AppNotification };
      },
    },
    /** Drop every notification tied to a task — used when that task is deleted. */
    clearNotificationsForTask(state, action: PayloadAction<number>) {
      state.items = state.items.filter((n) => n.taskId !== action.payload);
    },
    markRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload);
      if (item) item.read = true;
    },
    markAllRead(state) {
      state.items.forEach((n) => {
        n.read = true;
      });
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.items = state.items.filter((n) => n.id !== action.payload);
    },
    clearNotifications(state) {
      state.items = [];
    },
    hydrateNotifications(state, action: PayloadAction<{ items?: AppNotification[] }>) {
      if (Array.isArray(action.payload.items)) {
        state.items = action.payload.items;
      }
    },
  },
});

export const {
  pushNotification,
  clearNotificationsForTask,
  markRead,
  markAllRead,
  removeNotification,
  clearNotifications,
  hydrateNotifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
