'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Avatar } from '@/components/ui/Avatar';
import { useDismiss } from './useDismiss';

export function UserProfileMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), containerRef, triggerRef);

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className={clsx(
          'flex items-center gap-2 rounded-xl border border-transparent p-1 pr-2 transition-colors hover:border-glass-border hover:bg-glass-border',
          open && 'border-glass-border bg-glass-border'
        )}
      >
        <Avatar name={user.name} />
        <span className="hidden max-w-28 truncate text-sm font-medium text-text sm:block">
          {user.name}
        </span>
        <ChevronDown
          className={clsx('hidden h-4 w-4 text-text-subtle transition-transform duration-200 sm:block', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-dropdown mt-1 w-60 animate-scale-in overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-border p-3">
            <Avatar name={user.name} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{user.name}</p>
              <p className="truncate text-xs text-text-subtle">{user.email}</p>
            </div>
          </div>

          <div className="p-1">
            <button
              role="menuitem"
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-text hover:bg-surface-muted"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-text-muted" /> : <Moon className="h-4 w-4 text-text-muted" />}
              {theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
          </div>

          <div className="border-t border-border p-1">
            <button
              role="menuitem"
              type="button"
              onClick={logout}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                'text-danger hover:bg-danger-soft'
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
