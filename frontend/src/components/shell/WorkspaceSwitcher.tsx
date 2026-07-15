'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectActiveWorkspace, selectWorkspaces } from '@/store/selectors';
import { addWorkspace, setActiveWorkspace, type Workspace } from '@/store/slices/workspaceSlice';
import { useDismiss } from './useDismiss';

const SWATCH: Record<Workspace['color'], string> = {
  primary: 'bg-primary text-primary-fg',
  success: 'bg-success text-primary-fg',
  warning: 'bg-warning text-primary-fg',
  danger: 'bg-danger text-primary-fg',
};

/** The two-letter mark shown in the square badge. */
function mark(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * The workspace switcher that anchors the top of the sidebar. Workspaces are a
 * client-side organizational lens over the one shared backend team (see
 * workspaceSlice) — switching is instant and persisted.
 */
export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const dispatch = useAppDispatch();
  const workspaces = useAppSelector(selectWorkspaces);
  const active = useAppSelector(selectActiveWorkspace);

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setAdding(false);
    setName('');
  };
  useDismiss(open, close, containerRef, triggerRef);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    dispatch(addWorkspace(name));
    close();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Current workspace: ${active?.name}. Switch workspace`}
        className={clsx(
          'flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface p-2 text-left transition-colors hover:bg-surface-muted',
          collapsed && 'justify-center'
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold',
            SWATCH[active?.color ?? 'primary']
          )}
        >
          {mark(active?.name ?? '?')}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text">{active?.name}</span>
              <span className="block truncate text-xs text-text-subtle">Workspace</span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-text-subtle">
              ⌄
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Workspaces"
          className="absolute left-0 top-full z-dropdown mt-1 w-64 animate-scale-in overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-lg"
        >
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-text-subtle">
            Workspaces
          </p>
          {workspaces.map((workspace) => {
            const isActive = workspace.id === active?.id;
            return (
              <button
                key={workspace.id}
                role="menuitemradio"
                aria-checked={isActive}
                type="button"
                onClick={() => {
                  dispatch(setActiveWorkspace(workspace.id));
                  close();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-surface-muted"
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                    SWATCH[workspace.color]
                  )}
                >
                  {mark(workspace.name)}
                </span>
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {isActive && (
                  <span aria-hidden="true" className="shrink-0 text-primary">
                    ✓
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-1 border-t border-border" />

          {adding ? (
            <form onSubmit={handleCreate} className="p-1">
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Workspace name"
                maxLength={40}
                aria-label="New workspace name"
                className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-text outline-none placeholder:text-text-subtle focus:border-primary"
              />
              <div className="mt-1.5 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-55"
                >
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-text-muted hover:bg-surface-muted"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong text-sm"
              >
                +
              </span>
              New workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
