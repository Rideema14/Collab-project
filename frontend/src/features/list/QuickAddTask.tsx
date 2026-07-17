'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { useGetUsersQuery } from '@/store/api/backendApi';
import { setPriority } from '@/store/slices/tasksSlice';
import { PRIORITY_META } from '@/lib/domain/defaults';
import type { Priority } from '@/lib/domain/types';
import { cn } from '@/lib/design/cn';
import { useListActions } from './useListActions';

const QUICK_PRIORITIES: Priority[] = ['none', 'low', 'normal', 'high', 'urgent'];

/**
 * Inline "add a card" affordance. Creates a backend task, then drops it into the
 * given client status column. Enter submits and keeps the composer open for fast
 * multi-add; Escape / blur-empty closes it.
 */
export function QuickAddTask({
  listId,
  statusId,
  variant = 'card',
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  listId: string;
  statusId: string;
  variant?: 'card' | 'row';
  /** Controlled open state — when provided, the parent owns it (e.g. a header ＋). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When controlled + closed, render nothing instead of the "Add task" button. */
  hideTrigger?: boolean;
}) {
  const dispatch = useAppDispatch();
  const { createTask } = useListActions(listId);
  const { data: users = [] } = useGetUsersQuery();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setOpenState(next);
  };
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriorityDraft] = useState<Priority>('none');
  const [busy, setBusy] = useState(false);

  function reset() {
    setTitle('');
    setAssigneeId(null);
    setDueDate('');
    setPriorityDraft('none');
  }

  async function submit() {
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const created = await createTask({ title: value, statusId, assigneeId, dueDate: dueDate || null });
      if (created && priority !== 'none') dispatch(setPriority({ taskId: created.id, priority }));
      reset();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    if (hideTrigger) return null;
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
    <div
      className="rounded-lg border border-primary bg-surface p-2 shadow-sm"
      onBlur={(e) => {
        if (!title.trim() && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
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
        placeholder="Task name…"
        className="w-full resize-none bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
      />

      {/* Quick-set: assignee, due date, priority — matches the fuller task drawer, without opening it. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <select
          value={assigneeId ?? ''}
          onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
          aria-label="Assignee"
          className="h-6 rounded border border-border bg-surface px-1 text-[11px] text-text-muted"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date"
          className="h-6 rounded border border-border bg-surface px-1 text-[11px] text-text-muted"
        />
        <select
          value={priority}
          onChange={(e) => setPriorityDraft(e.target.value as Priority)}
          aria-label="Priority"
          className="h-6 rounded border border-border bg-surface px-1 text-[11px] text-text-muted"
        >
          {QUICK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-muted"
        >
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
