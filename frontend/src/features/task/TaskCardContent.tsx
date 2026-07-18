'use client';

import { memo } from 'react';
import { CheckSquare, MessageSquare, Paperclip } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectTags } from '@/store/selectors';
import { daysUntilDue } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import type { TaskVM, Priority } from '@/lib/domain/types';
import { Avatar } from '@/components/domain/AvatarStack';
import { vividCard, statusColors } from '@/lib/domain/status-color';
import { effectivePriority } from '@/lib/domain/priority';
import { useTheme } from '@/lib/theme-context';

/** Neutral grey surface for unprioritised, no-deadline tasks — pure black/white
 *  shades, no hue, so 'none' cards sit quietly next to the orange ones. */
const NEUTRAL_PALETTE = {
  bg: '#f1f1f2',
  border: '#e1e1e3',
  rail: '#a8a8ac',
  title: '#3a3a3d',
  meta: '#6b6b70',
  chipBg: '#e6e6e8',
  chipText: '#5b5b60',
  divider: '#d8d8da',
};

/** Orange INTENSITY per priority: 0 = boldest orange … 3 = palest; none = neutral. */
const PRIORITY_LEVEL: Record<Priority, number | null> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
  none: null,
};

/**
 * Colour a card by its EFFECTIVE priority (which auto-escalates as the deadline
 * nears — see effectivePriority): high/urgent → red, normal → blue, low → green,
 * none → neutral. So a task turns red on its own when the deadline gets close.
 * Vivid pastel cards on the light board, calmer tinted-dark cards on the dark
 * board — same hue logic, tuned per theme so neither ever reads as too loud.
 */
export function resolveTaskPalette(task: TaskVM, _theme: 'light' | 'dark') {
  // Solid ORANGE cards on both boards, keyed by priority intensity (shades of the
  // one brand hue). 'none' falls back to a neutral grey tile. Theme kept in the
  // signature for callers but no longer branches.
  const level = PRIORITY_LEVEL[effectivePriority(task)];
  return level === null ? NEUTRAL_PALETTE : vividCard(level);
}

/** "3 days left" / "Due today" / "2d overdue" / "No date" — plain footer text, no chip. */
function dueLabel(dueDate: string | null, overdue: boolean): string {
  if (!dueDate) return 'No date';
  const days = daysUntilDue(dueDate);
  if (overdue) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/**
 * Presentational task card — the same markup renders on the board and inside the
 * drag overlay, so a dragged card looks identical. A solid, fully-tinted surface
 * keyed to the effective priority (Bordio-style), the assignee's avatar sitting
 * right next to the title, solid-color tag pills, and a quiet footer (days-left
 * text on the left, counts on the right) — no accent rail, no progress bar, no
 * chip-style date badge.
 */
function TaskCardContentImpl({
  task,
  commentCount = 0,
  overlay = false,
  className,
  editing = false,
  titleDraft,
  onTitleDraftChange,
  onTitleCommit,
  onTitleCancel,
}: {
  task: TaskVM;
  commentCount?: number;
  overlay?: boolean;
  className?: string;
  /** Inline title-edit mode (triggered from the card's "Edit" menu action). */
  editing?: boolean;
  titleDraft?: string;
  onTitleDraftChange?: (value: string) => void;
  onTitleCommit?: () => void;
  onTitleCancel?: () => void;
}) {
  const { theme } = useTheme();
  const tags = useAppSelector(selectTags).filter((t) => task.rich.tagIds.includes(t.id));
  const subDone = task.rich.subtasks.filter((s) => s.done).length;
  const subTotal = task.rich.subtasks.length;
  const p = resolveTaskPalette(task, theme);
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'group/card relative overflow-hidden rounded-2xl border p-3.5 shadow-sm transition-shadow duration-200',
        isDark ? 'hover:shadow-[0_8px_22px_-8px_rgba(0,0,0,0.55)]' : 'hover:shadow-[0_8px_22px_-8px_rgba(24,39,75,0.2)]',
        overlay &&
          (isDark
            ? 'rotate-[1.5deg] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55)]'
            : 'rotate-[1.5deg] shadow-[0_16px_40px_-12px_rgba(24,39,75,0.28)]'),
        className
      )}
      style={{ background: p.bg, borderColor: p.border }}
    >
      {/* Avatar + title, side by side */}
      <div className="flex items-start gap-2.5">
        {task.assignee && <Avatar person={task.assignee} size={28} className="mt-0.5 shrink-0" />}
        {editing ? (
          // eslint-disable-next-line jsx-a11y/no-autofocus
          <input
            autoFocus
            value={titleDraft ?? task.title}
            onChange={(e) => onTitleDraftChange?.(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onTitleCommit?.();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onTitleCancel?.();
              }
            }}
            onBlur={() => onTitleCommit?.()}
            className="min-w-0 flex-1 rounded border border-primary pr-6 text-[15px] font-semibold leading-snug outline-none"
            style={{ color: p.title, background: 'rgb(255 255 255 / 0.85)' }}
          />
        ) : (
          <p className="min-w-0 flex-1 pr-6 pt-0.5 text-[15px] font-semibold leading-snug" style={{ color: p.title }}>
            {task.title}
          </p>
        )}
      </div>

      {/* Days-left / counts footer */}
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]" style={{ color: p.meta }}>
        <span className={cn('font-medium', task.isOverdue && 'font-semibold')}>
          {dueLabel(task.dueDate, task.isOverdue)}
        </span>
        <div className="flex shrink-0 items-center gap-2.5">
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
        </div>
      </div>

      {/* Tag pills — solid, saturated color against the card's own pastel surface */}
      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const sc = statusColors(t.hue, theme);
            return (
              <span
                key={t.id}
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: sc.solid, color: sc.onSolid }}
              >
                {t.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Memoized so a store update elsewhere (e.g. the 4s presence heartbeat) doesn't
 * re-render every card on the board — only cards whose props actually change.
 */
export const TaskCardContent = memo(TaskCardContentImpl);

