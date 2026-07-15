'use client';

import { Menu, Moon, Search, Sun } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { setMobileSidebarOpen, toggleCommandPalette } from '@/store/slices/uiSlice';
import { useTheme } from '@/lib/theme-context';
import { Kbd } from '@/components/ui/Misc';
import { Magnetic } from '@/components/ui/Motion';
import { NotificationCenter } from './NotificationCenter';
import { UserProfileMenu } from './UserProfileMenu';
import { PresenceStack } from './PresenceStack';

export function AppTopbar() {
  const dispatch = useAppDispatch();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="glass sticky top-2 z-dropdown my-2 flex h-14 shrink-0 items-center gap-2 rounded-2xl px-3 shadow-glass sm:px-4">
      <button
        type="button"
        onClick={() => dispatch(setMobileSidebarOpen(true))}
        aria-label="Open sidebar"
        className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition-colors hover:bg-glass-border hover:text-text md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => dispatch(toggleCommandPalette())}
        className="group flex h-9 items-center gap-2 rounded-xl border border-glass-border bg-glass px-3 text-sm text-text-subtle transition-colors hover:border-border-strong sm:w-80"
      >
        <Search className="h-4 w-4" />
        <span className="hidden flex-1 text-left sm:block">Search or jump to…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <PresenceStack />
        <Magnetic strength={0.25}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition-colors hover:bg-glass-border hover:text-text"
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </Magnetic>
        <NotificationCenter />
        <UserProfileMenu />
      </div>
    </header>
  );
}
