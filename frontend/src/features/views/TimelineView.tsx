'use client';

import { useMemo } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { dateOnly } from '@/lib/format';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import { useListData } from '@/features/list/useListData';

const DAY = 86400000;

/**
 * Horizontal time chart. Shared by the Timeline and Gantt views: `gantt` mode
 * additionally draws dependency links between bars. Each bar spans the task's
 * created date → due date (or a default 3-day window when undated).
 */
export function TimelineView({ listId, mode = 'timeline' }: { listId: string; mode?: 'timeline' | 'gantt' }) {
  const { allTasks } = useListData(listId);
  const { theme } = useTheme();
  const dispatch = useAppDispatch();

  const model = useMemo(() => {
    const tasks = allTasks.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!tasks.length) return null;
    const spans = tasks.map((t) => {
      const start = new Date(dateOnly(t.createdAt)).getTime();
      const end = t.dueDate ? new Date(dateOnly(t.dueDate)).getTime() : start + 3 * DAY;
      return { task: t, start, end: Math.max(end, start + DAY) };
    });
    const min = Math.min(...spans.map((s) => s.start));
    const max = Math.max(...spans.map((s) => s.end));
    const total = Math.max(max - min, DAY);
    return { spans, min, total, indexById: new Map(tasks.map((t, i) => [t.id, i])) };
  }, [allTasks]);

  const ROW_STRIDE = 38; // h-8 (32px) + space-y-1.5 (6px)
  const links = useMemo(() => {
    if (!model || mode !== 'gantt') return [];
    return model.spans.flatMap((sp, ti) =>
      sp.task.rich.dependencies
        .filter((d) => d.type === 'blocked_by')
        .map((d) => {
          const si = model.indexById.get(d.taskId);
          if (si === undefined) return null;
          const src = model.spans[si];
          return {
            sx: ((src.end - model.min) / model.total) * 100,
            sy: si * ROW_STRIDE + 16,
            tx: ((sp.start - model.min) / model.total) * 100,
            ty: ti * ROW_STRIDE + 16,
          };
        })
        .filter((l): l is { sx: number; sy: number; tx: number; ty: number } => l !== null)
    );
  }, [model, mode]);

  if (!model) return <p className="py-10 text-center text-sm text-text-subtle">Nothing to schedule yet.</p>;

  const weeks = Math.ceil(model.total / (7 * DAY));

  return (
    <div className="overflow-x-auto px-4 py-4">
      <div className="min-w-[720px]">
        {/* Week gridlines header */}
        <div className="mb-1 flex text-[10px] text-text-subtle">
          {Array.from({ length: weeks }, (_, i) => (
            <div key={i} className="flex-1 border-l border-border pl-1">
              {new Date(model.min + i * 7 * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>

        <div className="relative space-y-1.5">
          {mode === 'gantt' && links.length > 0 && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              <defs>
                <marker id="gantt-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-subtle)" />
                </marker>
              </defs>
              {links.map((l, i) => (
                <line
                  key={i}
                  x1={`${l.sx}%`}
                  y1={l.sy}
                  x2={`${l.tx}%`}
                  y2={l.ty}
                  stroke="var(--color-text-subtle)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  markerEnd="url(#gantt-arrow)"
                />
              ))}
            </svg>
          )}
          {model.spans.map(({ task, start, end }) => {
            const left = ((start - model.min) / model.total) * 100;
            const width = ((end - start) / model.total) * 100;
            const c = statusColors(task.status.hue, theme);
            const deps = mode === 'gantt' ? task.rich.dependencies.filter((d) => d.type === 'blocked_by') : [];
            return (
              <div key={task.id} className="relative flex h-8 items-center rounded bg-surface-muted/40">
                <button
                  type="button"
                  onClick={() => dispatch(openTask(task.id))}
                  className={cn('absolute flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium shadow-sm')}
                  style={{ left: `${left}%`, width: `${Math.max(width, 6)}%`, backgroundColor: c.solid, color: c.onSolid }}
                >
                  <span className="truncate">{task.title}</span>
                </button>
                {deps.length > 0 && (
                  <span className="absolute -left-1 top-1 text-[9px] text-text-subtle" style={{ left: `${left}%` }}>
                    ↳{deps.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
