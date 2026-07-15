'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { Project } from '@/lib/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectCommandPaletteOpen } from '@/store/selectors';
import { setCommandPaletteOpen, toggleSidebar } from '@/store/slices/uiSlice';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigation' | 'Projects' | 'Actions';
  icon: string;
  keywords?: string;
  perform: () => void;
}

/**
 * The ⌘K command palette. Fuzzy-searches real projects (from the API) alongside
 * navigation and quick actions, with arrow-key navigation and Enter to run.
 * Open state lives in Redux so the search bar, the keyboard shortcut, and any
 * other trigger all drive the one palette.
 */
export function CommandPalette({ projects }: { projects: Project[] }) {
  const open = useAppSelector(selectCommandPaletteOpen);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = () => dispatch(setCommandPaletteOpen(false));
  const run = (perform: () => void) => {
    perform();
    close();
  };

  const commands = useMemo<Command[]>(() => {
    const projectCommands: Command[] = projects.map((project) => ({
      id: `project-${project.id}`,
      label: project.name,
      hint: 'Open',
      group: 'Projects',
      icon: project.name.trim().charAt(0).toUpperCase() || '#',
      keywords: 'project board open',
      perform: () => router.push(`/projects/${project.id}`),
    }));

    const staticCommands: Command[] = [
      {
        id: 'nav-projects',
        label: 'Go to Projects',
        group: 'Navigation',
        icon: '▦',
        keywords: 'home all projects list',
        perform: () => router.push('/projects'),
      },
      {
        id: 'action-theme',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Actions',
        icon: theme === 'dark' ? '☀' : '☾',
        keywords: 'theme dark light appearance mode',
        perform: toggleTheme,
      },
      {
        id: 'action-collapse',
        label: 'Toggle sidebar',
        group: 'Actions',
        icon: '⇔',
        keywords: 'sidebar collapse expand',
        perform: () => dispatch(toggleSidebar()),
      },
      {
        id: 'action-signout',
        label: 'Sign out',
        group: 'Actions',
        icon: '⇥',
        keywords: 'logout sign out exit',
        perform: logout,
      },
    ];

    return [...staticCommands, ...projectCommands];
  }, [projects, router, theme, toggleTheme, logout, dispatch]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.keywords ?? ''}`.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Reset selection whenever the query (and therefore the result set) changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus the input and clear stale query each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // A tick after mount so the element exists to receive focus.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) run(selected.perform);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  let renderIndex = -1;
  let lastGroup: Command['group'] | null = null;

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 animate-fade-in bg-overlay" onClick={close} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative flex max-h-[70vh] w-full max-w-xl animate-scale-in flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <span aria-hidden="true" className="text-text-subtle">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={results[activeIndex] ? `command-${results[activeIndex].id}` : undefined}
            aria-label="Search projects and commands"
            placeholder="Search projects or run a command…"
            className="h-12 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-text-subtle sm:block">
            ESC
          </kbd>
        </div>

        <ul ref={listRef} id="command-list" role="listbox" className="flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-text-subtle">
              No results for “{query}”.
            </li>
          ) : (
            results.map((command) => {
              renderIndex += 1;
              const index = renderIndex;
              const isActive = index === activeIndex;
              const showHeader = command.group !== lastGroup;
              lastGroup = command.group;

              return (
                <li key={command.id}>
                  {showHeader && (
                    <p className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-subtle">
                      {command.group}
                    </p>
                  )}
                  <button
                    id={`command-${command.id}`}
                    data-index={index}
                    role="option"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => run(command.perform)}
                    onMouseMove={() => setActiveIndex(index)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                      isActive ? 'bg-primary-soft text-primary-on-soft' : 'text-text hover:bg-surface-muted'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs',
                        isActive ? 'bg-primary text-primary-fg' : 'bg-surface-muted text-text-muted'
                      )}
                    >
                      {command.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{command.label}</span>
                    {command.hint && (
                      <span className="shrink-0 text-xs text-text-subtle">{command.hint}</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
