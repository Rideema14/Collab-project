'use client';

import { ChevronRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { toggleExpanded } from '@/store/slices/hierarchySlice';
import { selectExpanded } from '@/store/selectors';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import { formatDueDate } from '@/lib/format';
import type { TaskVM } from '@/lib/domain/types';
import { Avatar } from '@/components/domain/AvatarStack';
import { PriorityFlag } from '@/components/domain/PriorityFlag';
import { useListData, type StatusColumn } from '@/features/list/useListData';
import { QuickAddTask } from '@/features/list/QuickAddTask';

/** Grouped-by-status list view — the dense, scannable counterpart to the board. */
export function ListView({ listId }: { listId: string }) {
  const { columns } = useListData(listId);
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4">
      {columns.map((col) => (
        <Group key={col.status.id} column={col} listId={listId} />
      ))}
    </div>
  );
}

function Group({ column, listId }: { column: StatusColumn; listId: string }) {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const expanded = useAppSelector(selectExpanded);
  const key = `listgroup:${listId}:${column.status.id}`;
  const open = expanded[key] !== false; // default open
  const c = statusColors(column.status.hue, theme);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <header
        className="flex cursor-pointer items-center gap-2 px-3 py-2"
        onClick={() => dispatch(toggleExpanded(key))}
        style={{ backgroundColor: c.soft }}
      >
        <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} style={{ color: c.onSoft }} />
        <span className="text-sm font-semibold" style={{ color: c.onSoft }}>
          {column.status.name}
        </span>
        <span className="text-xs" style={{ color: c.onSoft }}>
          {column.tasks.length}
        </span>
      </header>

      {open && (
        <div className="divide-y divide-border">
          {column.tasks.map((task) => (
            <Row key={task.id} task={task} onOpen={() => dispatch(openTask(task.id))} />
          ))}
          <div className="px-2 py-1">
            <QuickAddTask listId={listId} statusId={column.status.id} variant="row" />
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ task, onOpen }: { task: TaskVM; onOpen: () => void }) {
  const { theme } = useTheme();
  const dot = statusColors(task.status.hue, theme).solid;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
      <PriorityFlag priority={task.rich.priority} />
      <span className="min-w-0 flex-1 truncate text-text">{task.title}</span>
      {task.dueDate && (
        <span className={cn('shrink-0 text-xs text-text-subtle', task.isOverdue && 'font-medium text-danger')}>
          {formatDueDate(task.dueDate)}
        </span>
      )}
      {task.assignee && <Avatar person={task.assignee} size={22} />}
    </div>
  );
}
