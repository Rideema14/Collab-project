import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Live presence — who is online, which list they're viewing, who is typing on a
 * task. NEVER persisted (it's ephemeral by nature). Fed by the realtime bus:
 * each client heartbeats its own presence; the middleware merges peers here.
 */
export interface PresencePeer {
  userId: number;
  name: string;
  /** Client/tab id, so the same user in two tabs counts once per tab. */
  clientId: string;
  listId: string | null;
  /** Epoch ms of last heartbeat (stamped by the dispatcher, not the reducer). */
  lastSeen: number;
}

export interface PresenceState {
  /** This tab's own client id. */
  selfClientId: string;
  peers: Record<string, PresencePeer>;
  /** taskId → clientIds currently typing a comment. */
  typing: Record<number, string[]>;
}

const initialState: PresenceState = { selfClientId: '', peers: {}, typing: {} };

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setSelfClientId(state, action: PayloadAction<string>) {
      state.selfClientId = action.payload;
    },
    presenceSync(state, action: PayloadAction<PresencePeer>) {
      state.peers[action.payload.clientId] = action.payload;
    },
    presenceLeave(state, action: PayloadAction<string>) {
      delete state.peers[action.payload];
    },
    /** Drop peers whose last heartbeat is older than the cutoff (called on a timer). */
    prunePresence(state, action: PayloadAction<{ cutoff: number }>) {
      for (const [id, peer] of Object.entries(state.peers)) {
        if (peer.clientId !== state.selfClientId && peer.lastSeen < action.payload.cutoff) {
          delete state.peers[id];
        }
      }
    },
    setTyping(state, action: PayloadAction<{ taskId: number; clientId: string; typing: boolean }>) {
      const cur = state.typing[action.payload.taskId] ?? [];
      state.typing[action.payload.taskId] = action.payload.typing
        ? Array.from(new Set([...cur, action.payload.clientId]))
        : cur.filter((c) => c !== action.payload.clientId);
    },
  },
});

export const { setSelfClientId, presenceSync, presenceLeave, prunePresence, setTyping } =
  presenceSlice.actions;
export default presenceSlice.reducer;
