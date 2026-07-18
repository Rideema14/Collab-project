import type { Comment, StatusSet } from '@/lib/domain/types';
import type { PresencePeer } from '@/store/slices/presenceSlice';
import type { ChatMessage } from '@/store/slices/chatSlice';

/**
 * The single realtime event contract. Both transports (Socket.IO and the
 * cross-tab BroadcastChannel fallback) speak exactly this vocabulary, so nothing
 * downstream knows or cares which one is active.
 *
 * Every event carries the `origin` client id so a tab can ignore the echo of its
 * own emissions (the local reducer already applied them).
 */
export type RealtimeEvent =
  | { type: 'task:moved'; origin: string; projectId: number; taskId: number }
  | { type: 'task:changed'; origin: string; projectId: number }
  | { type: 'status:changed'; origin: string; set: StatusSet }
  | { type: 'comment:added'; origin: string; comment: Comment }
  | { type: 'chat:message'; origin: string; message: ChatMessage }
  | { type: 'chat:pin'; origin: string; channelId: string; messageId: string; pinned: boolean }
  | { type: 'chat:delete'; origin: string; channelId: string; messageId: string }
  | { type: 'presence:sync'; origin: string; peer: PresencePeer }
  | { type: 'presence:leave'; origin: string; clientId: string }
  | { type: 'typing'; origin: string; taskId: number; clientId: string; typing: boolean }
  | {
      type: 'notification:new';
      origin: string;
      /** When set, ONLY the client whose signed-in user matches this id shows the
       *  notification (e.g. the member who was assigned/affected). Omit to
       *  broadcast to everyone. */
      targetUserId?: number;
      tone?: 'info' | 'success' | 'warning';
      title: string;
      body?: string;
      /** Optional in-app route to open when the notification is clicked. */
      href?: string;
      /** The task this is about — lets the target drop it if the task is deleted. */
      taskId?: number;
    }
  | {
      /** Remove every notification about a task (e.g. it was deleted). Same
       *  targeting rule as notification:new. */
      type: 'notification:clear';
      origin: string;
      targetUserId?: number;
      taskId: number;
    };

export const RT_CHANNEL = 'kuberya-rt';
