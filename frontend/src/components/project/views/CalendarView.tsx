'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { Task } from '@/lib/types';
import { allTasks } from '@/lib/board';
import { todayIso } from '@/lib/format';
import { STATUS_STYLES } from '@/components/board/status-styles';
import { useProject } from '../ProjectProvider';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function CalendarView() {
  const { board, openEditTask, projectId } = useProject();

  const [year, month] = todayIso().split('-').map(Number);
  const [cursor, setCursor] = useState({ year, month: month - 1 }); // month is 0-indexed

  const { cells, byDate, undated, monthLabel } = useMemo(() => {
    const tasks = allTasks(board);

    const map = new Map<string, Task[]>();
    const noDate: Task[] = [];
    for (const task of tasks) {
      if (!task.dueDate) {
        noDate.push(task);
        continue;
      }
      const key = task.dueDate.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    }

    const startWeekday = new Date(cursor.year, cursor.month, 1).getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const grid = Array.from(
      { length: totalCells },
      (_, i) => new Date(cursor.year, cursor.month, 1 - startWeekday + i)
    );

    const label = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });

    return { cells: grid, byDate: map, undated: noDate, monthLabel: label };
  }, [board, cursor]);

  const today = todayIso();

  const step = (delta: number) =>
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const goToday = () => setCursor({ year, month: month - 1 });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <CalBtn onClick={() => step(-1)} label="Previous month">
            ‹
          </CalBtn>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-surface-muted hover:text-text"
          >
            Today
          </button>
          <CalBtn onClick={() => step(1)} label="Next month">
            ›
          </CalBtn>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-1.5 text-center text-xs font-medium text-text-subtle">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const iso = isoOf(date);
            const inMonth = date.getMonth() === cursor.month;
            const isToday = iso === today;
            const dayTasks = byDate.get(iso) ?? [];
            return (
              <div
                key={i}
                className={clsx(
                  'min-h-24 border-b border-r border-border p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                  inMonth ? 'bg-surface' : 'bg-surface-muted/40'
                )}
              >
                <div className="mb-1 flex justify-end px-1">
                  <span
                    className={clsx(
                      'flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums',
                      isToday ? 'bg-primary font-semibold text-primary-fg' : inMonth ? 'text-text-muted' : 'text-text-subtle'
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openEditTask(task)}
                      title={task.title}
                      className={clsx(
                        'flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-surface-muted',
                        task.isOverdue ? 'text-danger' : 'text-text-muted'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_STYLES[task.status].dot)}
                      />
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="px-1 text-[11px] text-text-subtle">+{dayTasks.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <p className="text-sm text-text-muted">
          {undated.length} task{undated.length === 1 ? '' : 's'} without a due date —{' '}
          <Link href={`/projects/${projectId}/list`} className="font-medium text-primary hover:underline">
            see them in List
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function CalBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface-muted hover:text-text"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
