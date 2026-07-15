'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/design/cn';
import { useListActions } from './useListActions';

/**
 * Inline "add a card" affordance. Creates a backend task, then drops it into the
 * given client status column. Enter submits and keeps the composer open for fast
 * multi-add; Escape / blur-empty closes it.
 */
export function QuickAddTask({
  listId,
  statusId,
  variant = 'card',
}: {
  listId: string;
  statusId: string;
  variant?: 'card' | 'row';
}) {
  const { createTask } = useListActions(listId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await createTask({ title: value, statusId });
      setTitle('');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-subtle transition-colors hover:bg-surface hover:text-text-muted',
          variant === 'row' && 'py-2'
        )}
      >
        <Plus className="h-4 w-4" /> Add task
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary bg-surface p-2 shadow-sm">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        placeholder="Task name…"
        className="w-full resize-none bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
      />
      <div className="mt-1 flex items-center justify-end gap-1.5">
        <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-muted">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!title.trim() || busy}
          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-55"
        >
          Add
        </button>
      </div>
    </div>
  );
}
