'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { dateOnly } from '@/lib/format';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import type { TaskVM } from '@/lib/domain/types';
import { useListData } from '@/features/list/useListData';
import { IconButton } from '@/components/ui/Misc';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Month calendar with tasks placed on their due date. Undated tasks are listed aside. */
export function CalendarView({ listId }: { listId: string }) {
  const { allTasks } = useListData(listId);
  const dispatch = useAppDispatch();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const byDay = useMemo(() => {
    const map = new Map<string, TaskVM[]>();
    for (const t of allTasks) {
      if (!t.dueDate) continue;
      const key = dateOnly(t.dueDate);
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    return map;
  }, [allTasks]);

  const first = new Date(cursor.year, cursor.month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayKey = dateOnly(new Date().toISOString());

  const shift = (d: number) => {
    const m = cursor.month + d;
    setCursor({ year: cursor.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text">{monthName}</h3>
        <div className="ml-auto flex items-center gap-1">
          <IconButton aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <IconButton aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-surface-muted px-2 py-1.5 text-center text-xs font-medium text-text-subtle">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const key = day ? `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const tasks = day ? byDay.get(key) ?? [] : [];
          return (
            <div key={i} className={cn('min-h-24 bg-surface p-1.5', !day && 'bg-surface-muted/40')}>
              {day && (
                <>
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                      key === todayKey ? 'bg-primary font-semibold text-primary-fg' : 'text-text-muted'
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {tasks.slice(0, 3).map((t) => (
                      <CalPill key={t.id} task={t} onOpen={() => dispatch(openTask(t.id))} />
                    ))}
                    {tasks.length > 3 && <p className="px-1 text-[10px] text-text-subtle">+{tasks.length - 3} more</p>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalPill({ task, onOpen }: { task: TaskVM; onOpen: () => void }) {
  const { theme } = useTheme();
  const c = statusColors(task.status.hue, theme);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px]"
      style={{ backgroundColor: c.soft, color: c.onSoft }}
    >
      {task.title}
    </button>
  );
}
