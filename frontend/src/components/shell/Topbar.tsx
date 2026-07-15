'use client';

import { useAppDispatch } from '@/store/hooks';
import { setMobileSidebarOpen } from '@/store/slices/uiSlice';
import { SearchBar } from './SearchBar';
import { NotificationCenter } from './NotificationCenter';
import { UserProfileMenu } from './UserProfileMenu';

export function Topbar() {
  const dispatch = useAppDispatch();

  return (
    <header className="sticky top-0 z-dropdown flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-4">
      {/* Hamburger — opens the sidebar drawer on mobile only. */}
      <button
        type="button"
        onClick={() => dispatch(setMobileSidebarOpen(true))}
        aria-label="Open sidebar"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text md:hidden"
      >
        <span aria-hidden="true" className="text-lg">
          ☰
        </span>
      </button>

      <SearchBar />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NotificationCenter />
        <UserProfileMenu />
      </div>
    </header>
  );
}
