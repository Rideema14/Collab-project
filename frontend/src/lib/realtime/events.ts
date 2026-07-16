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
  | { type: 'notification:new'; origin: string; title: string; body?: string };

export const RT_CHANNEL = 'kuberya-rt';
