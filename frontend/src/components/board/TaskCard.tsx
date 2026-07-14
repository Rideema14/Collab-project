'use client';

import React from 'react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useDraggable } from '@dnd-kit/core';
import type { Status, Task } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { formatDueDate } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

interface TaskCardProps {
  task: Task;
  onMove: (taskId: number, to: Status) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** True while rendered inside the <DragOverlay> — the floating copy. */
  overlay?: boolean;
}

/**
 * A task card. Draggable by pointer AND by keyboard (dnd-kit's KeyboardSensor
 * picks it up with Space), with the ⋮ menu as the explicit, always-available
 * path to the same PATCH /api/tasks/:taskId/status endpoint.
 *
 * Drag alone would fail the Playbook's a11y gate — "everything clickable must be
 * operable with Tab/Enter" — so the menu is not a nice-to-have, it's the
 * accessible route.
 */
export function TaskCard({ task, onMove, onEdit, onDelete, overlay = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: overlay,
    // Carried into the drag events so the screen-reader announcements can name
    // the task ("Picked up task Fix the login bug") instead of reading out an id.
    data: { title: task.title },
  });

  return (
    <div
      ref={setNodeRef}
      // The whole card is the drag handle. TaskMenu stops pointerdown from
      // reaching these listeners, so the ⋮ button and its items stay clickable.
      {...listeners}
      {...attributes}
      // No transform here: the dragged card stays in place at reduced opacity
      // while the DragOverlay renders the copy that follows the cursor.
      className={clsx(
        'group relative rounded-lg border border-border bg-surface p-3 shadow-sm',
        // touch-none: without it the browser treats a touch drag as a scroll and
        // the PointerSensor never activates.
        !overlay && 'cursor-grab touch-none',
        isDragging && 'opacity-40',
        overlay && 'rotate-1 cursor-grabbing shadow-lg'
      )}
    >
      <p className="pr-7 text-sm font-medium text-text">{task.title}</p>

      {(task.assignee || task.dueDate) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {task.assignee ? (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <Avatar name={task.assignee.name} />
              {task.assignee.name}
            </span>
          ) : null}

          {task.dueDate && (
            /* isOverdue is computed by the server; we render it, never re-derive it. */
            <Badge tone={task.isOverdue ? 'danger' : 'neutral'}>
              {task.isOverdue && <span className="sr-only">Overdue: </span>}
              <span aria-hidden="true">📅</span>
              {formatDueDate(task.dueDate)}
            </Badge>
          )}
        </div>
      )}

      {!overlay && (
        <TaskMenu task={task} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

function TaskMenu({
  task,
  onMove,
  onEdit,
  onDelete,
}: Pick<TaskCardProps, 'task' | 'onMove' | 'onEdit' | 'onDelete'>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus(); // Return focus to the trigger, not the void.
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const moveTargets = STATUSES.filter((status) => status !== task.status);

  return (
    <div
      ref={containerRef}
      // The card above is the drag handle. Without this, pressing the trigger or
      // any menu item would start a drag instead of activating the button.
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute right-1.5 top-1.5"
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${task.title}`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-subtle hover:bg-surface-muted hover:text-text"
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${task.title}`}
          className="absolute right-0 top-8 z-dropdown w-44 animate-scale-in overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-lg"
        >
          <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-text-subtle">
            Move to
          </p>
          {moveTargets.map((status) => (
            <button
              key={status}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onMove(task.id, status);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-text hover:bg-surface-muted"
            >
              {status}
            </button>
          ))}

          <div className="my-1 border-t border-border" />

          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit(task);
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-text hover:bg-surface-muted"
          >
            Edit task
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete(task);
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger-soft"
          >
            Delete task
          </button>
        </div>
      )}
    </div>
  );
}
