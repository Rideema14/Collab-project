'use client';

import clsx from 'clsx';
import { useDroppable } from '@dnd-kit/core';
import type { Status, Task } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { EmptyState } from '@/components/ui/States';

interface BoardColumnProps {
  status: Status;
  tasks: Task[];
  onMove: (taskId: number, to: Status) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/** A visual accent per column, so the three states are distinguishable at a glance. */
const ACCENT: Record<Status, string> = {
  'To Do': 'bg-text-subtle',
  'In Progress': 'bg-primary',
  Done: 'bg-success',
};

export function BoardColumn({ status, tasks, onMove, onEdit, onDelete }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      aria-labelledby={`column-${status.replace(/\s/g, '-')}`}
      className="flex min-w-0 flex-col"
    >
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className={clsx('h-2 w-2 rounded-full', ACCENT[status])} />
        <h2
          id={`column-${status.replace(/\s/g, '-')}`}
          className="text-sm font-semibold text-text"
        >
          {status}
        </h2>
        <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-xs text-text-muted">
          {tasks.length}
          <span className="sr-only"> tasks</span>
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          'flex min-h-32 flex-1 flex-col gap-2 rounded-lg border-2 border-dashed p-2 transition-colors',
          // The drop target has to be visibly obvious while a card is over it.
          isOver ? 'border-primary bg-primary-soft' : 'border-transparent bg-surface-muted'
        )}
      >
        {tasks.length === 0 ? (
          <EmptyState
            compact
            title="Nothing here"
            message={
              status === 'To Do' ? 'Add a task to get started.' : `Drag a task into ${status}.`
            }
          />
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
