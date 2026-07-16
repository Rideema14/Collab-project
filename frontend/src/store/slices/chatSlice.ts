import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Client-only team chat: group channels, private direct-message channels, and
 * broadcast announcements. The backend has no chat table, so this persists locally
 * (Redux Persist) and broadcasts over the realtime bus so other tabs — and, with a
 * Socket.IO server, other users — see messages live.
 */
export type ChannelKind = 'channel' | 'dm';

export interface ChatChannel {
  id: string;
  name: string;
  kind: ChannelKind;
  /** For a DM: the two user ids in the conversation. */
  memberIds?: number[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: number;
  /** Denormalised so a message renders without a user lookup. */
  authorName: string;
  body: string;
  createdAt: string;
  /** Posted via "Announcement" — rendered highlighted in every group channel. */
  isAnnouncement?: boolean;
  /** Pinned to the top of its channel. */
  pinned?: boolean;
}

export interface ChatState {
  channels: ChatChannel[];
  messagesByChannel: Record<string, ChatMessage[]>;
  activeChannelId: string;
}

export const DEFAULT_CHANNEL_ID = 'ch-general';

/** Deterministic id for the DM between two users (order-independent). */
export function dmChannelId(a: number, b: number): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `dm-${lo}-${hi}`;
}

const initialState: ChatState = {
  channels: [
    { id: DEFAULT_CHANNEL_ID, name: 'general', kind: 'channel', createdAt: '1970-01-01T00:00:00.000Z' },
    { id: 'ch-random', name: 'random', kind: 'channel', createdAt: '1970-01-01T00:00:00.000Z' },
  ],
  messagesByChannel: {},
  activeChannelId: DEFAULT_CHANNEL_ID,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChannel(state, action: PayloadAction<string>) {
      if (state.channels.some((c) => c.id === action.payload)) state.activeChannelId = action.payload;
    },
    addChannel: {
      reducer(state, action: PayloadAction<ChatChannel>) {
        state.channels.push(action.payload);
        state.activeChannelId = action.payload.id;
      },
      prepare(input: { name: string; createdAt: string }) {
        return {
          payload: {
            id: `ch-${nanoid(6)}`,
            name: input.name.trim().replace(/^#/, '') || 'channel',
            kind: 'channel' as const,
            createdAt: input.createdAt,
          } satisfies ChatChannel,
        };
      },
    },
    /** Ensure a private DM channel exists with `otherId` and make it active. */
    openDm: {
      reducer(state, action: PayloadAction<ChatChannel>) {
        if (!state.channels.some((c) => c.id === action.payload.id)) state.channels.push(action.payload);
        state.activeChannelId = action.payload.id;
      },
      prepare(input: { selfId: number; otherId: number; otherName: string; createdAt: string }) {
        return {
          payload: {
            id: dmChannelId(input.selfId, input.otherId),
            name: input.otherName,
            kind: 'dm' as const,
            memberIds: [input.selfId, input.otherId],
            createdAt: input.createdAt,
          } satisfies ChatChannel,
        };
      },
    },
    sendMessage: {
      reducer(state, action: PayloadAction<ChatMessage>) {
        (state.messagesByChannel[action.payload.channelId] ??= []).push(action.payload);
      },
      prepare(input: {
        channelId: string;
        authorId: number;
        authorName: string;
        body: string;
        createdAt: string;
        isAnnouncement?: boolean;
      }) {
        return {
          payload: {
            id: `msg-${nanoid(10)}`,
            channelId: input.channelId,
            authorId: input.authorId,
            authorName: input.authorName,
            body: input.body.trim(),
            createdAt: input.createdAt,
            isAnnouncement: input.isAnnouncement,
          } satisfies ChatMessage,
        };
      },
    },
    /** Pin / unpin a message (explicit value so it's safe to replay from the bus). */
    setPinned(state, action: PayloadAction<{ channelId: string; messageId: string; pinned: boolean }>) {
      const m = state.messagesByChannel[action.payload.channelId]?.find((x) => x.id === action.payload.messageId);
      if (m) m.pinned = action.payload.pinned;
    },
    /** Delete a message (idempotent — safe to replay from the bus). */
    deleteMessage(state, action: PayloadAction<{ channelId: string; messageId: string }>) {
      const list = state.messagesByChannel[action.payload.channelId];
      if (list) {
        state.messagesByChannel[action.payload.channelId] = list.filter((m) => m.id !== action.payload.messageId);
      }
    },
    /** Idempotent insert used by the realtime bus (skips echoes of our own message). */
    receiveMessage(state, action: PayloadAction<ChatMessage>) {
      const msg = action.payload;
      const list = (state.messagesByChannel[msg.channelId] ??= []);
      if (!list.some((m) => m.id === msg.id)) list.push(msg);

      // A DM from someone we haven't opened a thread with yet: register the channel
      // (named after the sender) so it shows up live in the recipient's sidebar.
      if (msg.channelId.startsWith('dm-') && !state.channels.some((c) => c.id === msg.channelId)) {
        const memberIds = msg.channelId
          .slice(3)
          .split('-')
          .map(Number)
          .filter((n) => !Number.isNaN(n));
        state.channels.push({
          id: msg.channelId,
          name: msg.authorName,
          kind: 'dm',
          memberIds,
          createdAt: msg.createdAt,
        });
      }
    },
  },
});

export const { setActiveChannel, addChannel, openDm, sendMessage, receiveMessage, setPinned, deleteMessage } =
  chatSlice.actions;
export default chatSlice.reducer;
