import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Cross-cutting shell UI state — the bits that more than one component reads or
 * writes and that must survive a route change (which unmounts page components).
 *
 * Deliberately NOT here: transient, single-owner state like whether the profile
 * dropdown is open. That stays local to its component, where React state is the
 * simpler tool. Redux earns its place only for state shared across the shell.
 */
export interface UiState {
  /** The desktop sidebar's rail/expanded state. Persisted across sessions. */
  sidebarCollapsed: boolean;
  /** The sidebar drawer on mobile, where it overlays the page instead of pushing it. */
  mobileSidebarOpen: boolean;
  /** The ⌘K global command palette. Opened from the search bar and the shortcut. */
  commandPaletteOpen: boolean;
  /** The list the user is currently viewing — read by presence heartbeat. Not persisted. */
  activeListId: string | null;
  /** Task detail drawer target (backend task id), or null when closed. Not persisted. */
  openTaskId: number | null;
  /** Favorited list ids shown in the sidebar's Favorites section. Persisted. */
  favorites: string[];
}

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  commandPaletteOpen: false,
  activeListId: null,
  openTaskId: null,
  favorites: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    setMobileSidebarOpen(state, action: PayloadAction<boolean>) {
      state.mobileSidebarOpen = action.payload;
    },
    setCommandPaletteOpen(state, action: PayloadAction<boolean>) {
      state.commandPaletteOpen = action.payload;
    },
    toggleCommandPalette(state) {
      state.commandPaletteOpen = !state.commandPaletteOpen;
    },
    setActiveListId(state, action: PayloadAction<string | null>) {
      state.activeListId = action.payload;
    },
    openTask(state, action: PayloadAction<number>) {
      state.openTaskId = action.payload;
    },
    closeTask(state) {
      state.openTaskId = null;
    },
    /** Star / unstar a list into the sidebar Favorites section. */
    toggleFavorite(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.favorites = state.favorites.includes(id)
        ? state.favorites.filter((f) => f !== id)
        : [...state.favorites, id];
    },
    /** Rehydrate persisted fields on the client after mount (see StoreProvider). */
    hydrateUi(state, action: PayloadAction<Partial<UiState>>) {
      if (typeof action.payload.sidebarCollapsed === 'boolean') {
        state.sidebarCollapsed = action.payload.sidebarCollapsed;
      }
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  setMobileSidebarOpen,
  setCommandPaletteOpen,
  toggleCommandPalette,
  setActiveListId,
  openTask,
  closeTask,
  toggleFavorite,
  hydrateUi,
} = uiSlice.actions;

export default uiSlice.reducer;
