'use client';

import { CheckSquare, MessageSquare, Paperclip } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectTags } from '@/store/selectors';
import { formatDueDate } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import type { TaskVM } from '@/lib/domain/types';
import { Avatar } from '@/components/domain/AvatarStack';
import { PriorityBadge } from '@/components/domain/PriorityFlag';
import { TagChip } from '@/components/domain/TagChip';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';

/**
 * Presentational task card — the same markup renders in the board and inside the
 * drag overlay, so a dragged card looks identical. Glass surface, status accent
 * rail, priority badge, tags, meta row, and a subtask progress bar.
 */
export function TaskCardContent({
  task,
  commentCount = 0,
  overlay = false,
  className,
}: {
  task: TaskVM;
  commentCount?: number;
  overlay?: boolean;
  className?: string;
}) {
  const { theme } = useTheme();
  const tags = useAppSelector(selectTags).filter((t) => task.rich.tagIds.includes(t.id));
  const subDone = task.rich.subtasks.filter((s) => s.done).length;
  const subTotal = task.rich.subtasks.length;
  const c = statusColors(task.status.hue, theme);

  return (
    <div
      className={cn(
        'group/card relative overflow-hidden rounded-xl border border-glass-border bg-surface-raised/80 p-3 backdrop-blur',
        'shadow-sm transition-shadow duration-200 hover:shadow-md',
        overlay && 'rotate-[1.5deg] shadow-lg ring-1 ring-[color:var(--color-primary)]/40',
        className
      )}
    >
      {/* status accent rail */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: c.solid }} />

      <div className="pl-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium leading-snug text-text">{task.title}</p>
          <PriorityBadge priority={task.rich.priority} />
        </div>

        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </div>
        )}

        {subTotal > 0 && (
          <div className="mt-2.5">
            <div className="h-1 overflow-hidden rounded-full bg-glass-border">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${(subDone / subTotal) * 100}%`, background: c.solid }}
              />
            </div>
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-3 text-xs text-text-subtle">
          {task.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
                task.isOverdue ? 'bg-danger-soft font-medium text-danger-fg' : 'bg-glass-border/60'
              )}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {subTotal > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5" /> {subDone}/{subTotal}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {commentCount}
            </span>
          )}
          {task.rich.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> {task.rich.attachments.length}
            </span>
          )}
          <span className="ml-auto">{task.assignee && <Avatar person={task.assignee} size={22} />}</span>
        </div>
      </div>
    </div>
  );
}
