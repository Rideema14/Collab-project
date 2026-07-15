'use client';

import clsx from 'clsx';
import { useDroppable } from '@dnd-kit/core';
import type { Status, Task } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { STATUS_STYLES } from './status-styles';

interface BoardColumnProps {
  status: Status;
  tasks: Task[];
  onMove: (taskId: number, to: Status) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** Only 'To Do' gets a quick-add: the backend puts every new task there. */
  onAdd?: () => void;
}

export function BoardColumn({ status, tasks, onMove, onEdit, onDelete, onAdd }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = STATUS_STYLES[status];
  const headingId = `column-${status.replace(/\s/g, '-')}`;

  return (
    <section
      aria-labelledby={headingId}
      className={clsx(
        'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface-muted transition-colors',
        // The drop target has to be unmistakable while a card is over it.
        isOver ? 'border-primary' : 'border-border'
      )}
    >
      {/* The accent bar: the fastest read of which column you're looking at. */}
      <span aria-hidden="true" className={clsx('h-1 w-full shrink-0', style.bar)} />

      <div className="flex items-center gap-2 px-3 py-2.5">
        <span aria-hidden="true" className={clsx('h-2 w-2 shrink-0 rounded-full', style.dot)} />
        <h2
          id={headingId}
          className="truncate text-xs font-semibold uppercase tracking-wide text-text-muted"
        >
          {status}
        </h2>
        <span
          className={clsx(
            'ml-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            style.chip
          )}
        >
          {tasks.length}
          <span className="sr-only"> tasks</span>
        </span>

        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add a task to ${status}`}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base leading-none text-text-subtle transition-colors hover:bg-surface hover:text-text"
          >
            <span aria-hidden="true">+</span>
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          'flex min-h-32 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 pt-0.5 transition-colors',
          // md+ the three columns sit side by side, so cap their height and let
          // each scroll on its own instead of stretching the page to the longest.
          'md:max-h-[calc(100vh-17rem)]',
          isOver && 'bg-primary-soft'
        )}
      >
        {tasks.length === 0 ? (
          <div
            className={clsx(
              'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center transition-colors',
              isOver ? 'border-primary' : 'border-border-strong'
            )}
          >
            <p className="text-sm font-medium text-text-muted">Nothing here</p>
            <p className="text-xs text-text-subtle">
              {status === 'To Do' ? 'Add a task to get started.' : `Drag a task into ${status}.`}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onMove={onMove}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}
