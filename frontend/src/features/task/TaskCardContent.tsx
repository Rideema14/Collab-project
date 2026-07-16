'use client';

import { memo } from 'react';
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  GripVertical,
  MessageSquare,
  Minus,
  Paperclip,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectTags } from '@/store/selectors';
import { formatCardDate } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import type { Priority, TaskVM } from '@/lib/domain/types';
import { Avatar } from '@/components/domain/AvatarStack';
import { vividCard } from '@/lib/domain/status-color';
import { effectivePriority } from '@/lib/domain/priority';
import { PRIORITY_META } from '@/lib/domain/defaults';

/** Soft neutral surface for unprioritised, no-deadline tasks. */
const NEUTRAL_PALETTE = {
  bg: '#eef1f6',
  border: '#dce0e8',
  rail: '#aab1bf',
  title: '#3a4150',
  meta: '#6b7280',
  chipBg: '#e4e7ee',
  chipText: '#5b6172',
  divider: '#d4d9e2',
};

/** Hue per priority bucket: red = high/urgent, blue = normal, green = low. */
const PRIORITY_HUE: Record<Priority, number | null> = {
  urgent: 0,
  high: 0,
  normal: 211,
  low: 142,
  none: null,
};

/**
 * Colour a card by its EFFECTIVE priority (which auto-escalates as the deadline
 * nears — see effectivePriority): high/urgent → red, normal → blue, low → green,
 * none → neutral. So a task turns red on its own when the deadline gets close.
 */
function resolveTaskPalette(task: TaskVM) {
  const hue = PRIORITY_HUE[effectivePriority(task)];
  return hue === null ? NEUTRAL_PALETTE : vividCard(hue);
}

/**
 * Presentational task card — the same markup renders on the board and inside the
 * drag overlay, so a dragged card looks identical. Vibrant pastel surface keyed to
 * the effective priority, a colored accent rail, a tight dark title, muted tag
 * pills, a thin subtask bar, and a divided footer (date · priority · handle).
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
  const tags = useAppSelector(selectTags).filter((t) => task.rich.tagIds.includes(t.id));
  const subDone = task.rich.subtasks.filter((s) => s.done).length;
  const subTotal = task.rich.subtasks.length;
  const p = resolveTaskPalette(task);

  return (
    <div
      className={cn(
        'group/card relative overflow-hidden rounded-xl border p-4 transition-shadow duration-200',
        'hover:shadow-[0_6px_18px_-8px_rgba(24,39,75,0.18)]',
        overlay && 'rotate-[1.5deg] shadow-[0_16px_40px_-12px_rgba(24,39,75,0.28)]',
        className
      )}
      style={{ background: p.bg, borderColor: p.border }}
    >
      {/* Colored accent rail */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: p.rail }} />

      {/* Title — tight, dark, readable on the pastel; room for the hover actions button */}
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
          className="w-full rounded border border-primary bg-white/80 pr-6 text-sm font-semibold leading-snug outline-none"
          style={{ color: p.title }}
        />
      ) : (
        <p className="pr-6 text-sm font-semibold leading-snug" style={{ color: p.title }}>
          {task.title}
        </p>
      )}

      {/* Tag pills */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const tp = vividCard(t.hue);
            return (
              <span
                key={t.id}
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.65)', color: tp.chipText }}
              >
                {t.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Subtask progress — single thin line */}
      {subTotal > 0 && (
        <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ background: p.divider }}>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${(subDone / subTotal) * 100}%`, background: p.rail }}
          />
        </div>
      )}

      {/* Footer — a hairline divider in the card's own darker shade */}
      <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: p.divider }}>
        <DateBadge dueDate={task.dueDate} overdue={task.isOverdue} meta={p.meta} />

        <div className="ml-auto flex items-center gap-2.5 text-[11px]" style={{ color: p.meta }}>
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
          <PriorityArrow priority={effectivePriority(task)} />
          {task.assignee && <Avatar person={task.assignee} size={22} />}
          <GripVertical className="h-4 w-4 text-black/20" aria-hidden />
        </div>
      </div>
    </div>
  );
}

/** Tiny calendar chip. Always present so every card has a dated footer. */
function DateBadge({ dueDate, overdue, meta }: { dueDate: string | null; overdue: boolean; meta: string }) {
  if (dueDate && overdue) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#fde2e2] px-2 py-1 text-[11px] font-medium text-[#c0392b]">
        <CalendarDays className="h-3.5 w-3.5" />
        {formatCardDate(dueDate)}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-white/70 px-2 py-1 text-[11px] font-medium"
      style={{ color: meta }}
    >
      <CalendarDays className="h-3.5 w-3.5" />
      {dueDate ? formatCardDate(dueDate) : 'No date'}
    </span>
  );
}

const PRIORITY_ARROW: Record<Priority, typeof ChevronUp | null> = {
  urgent: ChevronsUp,
  high: ChevronUp,
  normal: Minus,
  low: ChevronDown,
  none: null,
};

/** Minimalist colour-coded priority arrow. Renders nothing for 'none'. */
function PriorityArrow({ priority }: { priority: Priority }) {
  const Icon = PRIORITY_ARROW[priority];
  if (!Icon) return null;
  const h = PRIORITY_META[priority].hue;
  const color = `hsl(${h} 58% 48%)`;
  return <Icon className="h-4 w-4 shrink-0" style={{ color }} aria-label={`${PRIORITY_META[priority].label} priority`} />;
}

/**
 * Memoized so a store update elsewhere (e.g. the 4s presence heartbeat) doesn't
 * re-render every card on the board — only cards whose props actually change.
 */
export const TaskCardContent = memo(TaskCardContentImpl);
