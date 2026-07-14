'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

export function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-dropdown border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/projects"
          className="rounded-sm text-sm font-semibold tracking-tight text-text sm:text-base"
        >
          Task Board
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            // The icon alone is meaningless to a screen reader; the label says what happens.
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </Button>

          {user && (
            <>
              <span className="hidden items-center gap-2 text-sm text-text-muted sm:flex">
                <Avatar name={user.name} />
                {user.name}
              </span>
              <Button variant="secondary" size="sm" onClick={logout}>
                Sign out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
