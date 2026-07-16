import { createAction, type Middleware } from '@reduxjs/toolkit';
import { createBus, type RealtimeBus } from '@/lib/realtime/bus';
import type { RealtimeEvent } from '@/lib/realtime/events';
import { backendApi } from '../api/backendApi';
import {
  presenceLeave,
  presenceSync,
  prunePresence,
  setSelfClientId,
  setTyping,
} from '../slices/presenceSlice';
import { addComment, receiveComment } from '../slices/commentsSlice';
import { sendMessage, receiveMessage, setPinned, deleteMessage } from '../slices/chatSlice';
import { pushNotification } from '../slices/notificationsSlice';
import {
  createStatusSet,
  cloneSetForList,
  addStatus,
  updateStatus,
  removeStatus,
  reorderStatus,
  receiveStatusSet,
} from '../slices/statusesSlice';

/** Dispatch once (from the shell) to boot the realtime bus. */
export const realtimeInit = createAction('realtime/init');
/** Explicitly broadcast an event to peers (used for board moves, typing, etc.). */
export const broadcast = createAction<RealtimeEvent>('realtime/broadcast');

const HEARTBEAT_MS = 4000;
const PRESENCE_TTL_MS = 12000;

function randomClientId(): string {
  // crypto is available in the browser; fall back to a time+counter-free token.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c-${Math.abs(Math.floor(performance.now())).toString(36)}`;
}

export function createSocketMiddleware(): Middleware {
  let bus: RealtimeBus | null = null;
  let clientId = '';
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let pruner: ReturnType<typeof setInterval> | null = null;

  return (store) => (next) => (action) => {
    // ---- Boot ----
    if (realtimeInit.match(action) && !bus && typeof window !== 'undefined') {
      clientId = randomClientId();
      store.dispatch(setSelfClientId(clientId));
      bus = createBus();

      bus.on((event) => {
        if (event.origin === clientId) return; // ignore our own echo
        switch (event.type) {
          case 'task:moved':
          case 'task:changed':
            store.dispatch(backendApi.util.invalidateTags([{ type: 'Board', id: event.projectId }]));
            break;
          case 'comment:added':
            store.dispatch(receiveComment(event.comment));
            break;
          case 'chat:message':
            store.dispatch(receiveMessage(event.message));
            break;
          case 'chat:pin':
            store.dispatch(setPinned({ channelId: event.channelId, messageId: event.messageId, pinned: event.pinned }));
            break;
          case 'chat:delete':
            store.dispatch(deleteMessage({ channelId: event.channelId, messageId: event.messageId }));
            break;
          case 'presence:sync':
            store.dispatch(presenceSync(event.peer));
            break;
          case 'presence:leave':
            store.dispatch(presenceLeave(event.clientId));
            break;
          case 'typing':
            store.dispatch(setTyping({ taskId: event.taskId, clientId: event.clientId, typing: event.typing }));
            break;
          case 'status:changed':
            store.dispatch(receiveStatusSet(event.set));
            break;
          case 'notification:new':
            store.dispatch(
              pushNotification({
                tone: 'info',
                title: event.title,
                body: event.body,
                createdAt: new Date().toISOString(),
              })
            );
            break;
        }
      });

      const beat = () => {
        const state = store.getState();
        const user = state.session.user;
        if (!bus || !user) return;
        const peer = {
          userId: user.id,
          name: user.name,
          clientId,
          listId: state.ui.activeListId,
          lastSeen: Date.now(),
        };
        store.dispatch(presenceSync(peer)); // reflect self locally
        bus.emit({ type: 'presence:sync', origin: clientId, peer });
      };
      heartbeat = setInterval(beat, HEARTBEAT_MS);
      pruner = setInterval(
        () => store.dispatch(prunePresence({ cutoff: Date.now() - PRESENCE_TTL_MS })),
        HEARTBEAT_MS
      );
      beat();

      window.addEventListener('beforeunload', () => {
        bus?.emit({ type: 'presence:leave', origin: clientId, clientId });
        bus?.close();
        if (heartbeat) clearInterval(heartbeat);
        if (pruner) clearInterval(pruner);
      });
      return next(action);
    }

    // ---- Explicit outbound broadcast ----
    if (broadcast.match(action)) {
      bus?.emit({ ...action.payload, origin: clientId });
      return next(action);
    }

    const result = next(action);

    // ---- Auto-broadcast selected local actions ----
    if (bus) {
      // A locally created comment → tell peers.
      if (addComment.match(action)) {
        bus.emit({ type: 'comment:added', origin: clientId, comment: action.payload });
      }
      // A locally sent chat message → tell peers.
      if (sendMessage.match(action)) {
        bus.emit({ type: 'chat:message', origin: clientId, message: action.payload });
      }
      // Local pin / delete → tell peers.
      if (setPinned.match(action)) {
        bus.emit({ type: 'chat:pin', origin: clientId, ...action.payload });
      }
      if (deleteMessage.match(action)) {
        bus.emit({ type: 'chat:delete', origin: clientId, ...action.payload });
      }
      // Any status-set edit (add/rename/recolor/regroup/reorder/archive/delete, or a
      // fresh fork/clone) → broadcast the WHOLE resulting set. Statuses aren't
      // backend-authoritative like tasks, so peers can't just refetch — they need the
      // actual data, same as chat/comments above.
      const setId = createStatusSet.match(action)
        ? action.payload.id
        : cloneSetForList.match(action)
          ? action.payload.newSetId
          : addStatus.match(action) || updateStatus.match(action) || removeStatus.match(action) || reorderStatus.match(action)
            ? action.payload.setId
            : null;
      if (setId) {
        const set = store.getState().statuses.sets[setId];
        if (set) bus.emit({ type: 'status:changed', origin: clientId, set });
      }

      // Backend task writes complete → tell peers to refetch that board.
      const a = action as { type?: string; meta?: { arg?: { endpointName?: string; originalArgs?: { projectId?: number } } } };
      if (a.type === 'backendApi/executeMutation/fulfilled') {
        const endpoint = a.meta?.arg?.endpointName;
        const projectId = a.meta?.arg?.originalArgs?.projectId;
        if (projectId != null && endpoint && ['createTask', 'updateTask', 'deleteTask', 'updateTaskStatus'].includes(endpoint)) {
          bus.emit({ type: 'task:changed', origin: clientId, projectId });
        }
      }
    }

    return result;
  };
}
