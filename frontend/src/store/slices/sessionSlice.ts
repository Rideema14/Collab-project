import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '@/lib/types';

/**
 * A store-level mirror of the authenticated user, so middleware and selectors
 * (presence, comment authorship, "assigned to me") can read the current user
 * without depending on React context. AuthProvider is the single writer, via a
 * small effect in the app shell. NOT persisted — the auth-context owns the durable
 * token in localStorage; this is derived session state.
 */
export interface SessionState {
  user: AuthUser | null;
}

const initialState: SessionState = { user: null };

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSessionUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
    },
  },
});

export const { setSessionUser } = sessionSlice.actions;
export default sessionSlice.reducer;
