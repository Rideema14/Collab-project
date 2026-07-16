import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { AiPlan } from '@/lib/types';

/**
 * State for the global AI Workspace Assistant: the conversation, a log of the
 * actions it has performed, a plan waiting for the user's confirmation (for
 * destructive / bulk operations), and transient UI flags.
 */
export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  tone?: 'default' | 'error';
}

export interface AiActionRecord {
  id: string;
  summary: string;
  at: string;
  status: 'done' | 'failed';
}

export interface AiPending {
  prompt: string;
  plan: AiPlan;
}

export interface AiState {
  messages: AiMessage[];
  actionHistory: AiActionRecord[];
  pending: AiPending | null;
  busy: boolean;
  open: boolean;
}

const initialState: AiState = {
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm your workspace assistant. Try “Create a project called Mobile App Redesign”, “Show me all tasks due this week”, or “Move all overdue tasks to Testing”.",
      at: '1970-01-01T00:00:00.000Z',
    },
  ],
  actionHistory: [],
  pending: null,
  busy: false,
  open: false,
};

const MAX_HISTORY = 50;

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    addMessage: {
      reducer(state, action: PayloadAction<AiMessage>) {
        state.messages.push(action.payload);
      },
      prepare(input: { role: AiMessage['role']; text: string; tone?: AiMessage['tone'] }) {
        return {
          payload: {
            id: `m-${nanoid(8)}`,
            role: input.role,
            text: input.text,
            tone: input.tone,
            at: new Date().toISOString(),
          } satisfies AiMessage,
        };
      },
    },
    recordAction: {
      reducer(state, action: PayloadAction<AiActionRecord>) {
        state.actionHistory.unshift(action.payload);
        if (state.actionHistory.length > MAX_HISTORY) state.actionHistory.length = MAX_HISTORY;
      },
      prepare(input: { summary: string; status: AiActionRecord['status'] }) {
        return {
          payload: {
            id: `a-${nanoid(8)}`,
            summary: input.summary,
            status: input.status,
            at: new Date().toISOString(),
          } satisfies AiActionRecord,
        };
      },
    },
    setBusy(state, action: PayloadAction<boolean>) {
      state.busy = action.payload;
    },
    setPending(state, action: PayloadAction<AiPending | null>) {
      state.pending = action.payload;
    },
    setAiOpen(state, action: PayloadAction<boolean>) {
      state.open = action.payload;
    },
    toggleAiOpen(state) {
      state.open = !state.open;
    },
    clearConversation(state) {
      state.messages = initialState.messages;
      state.pending = null;
    },
  },
});

export const { addMessage, recordAction, setBusy, setPending, setAiOpen, toggleAiOpen, clearConversation } =
  aiSlice.actions;
export default aiSlice.reducer;
