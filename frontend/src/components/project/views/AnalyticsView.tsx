'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { STATUSES } from '@/lib/types';
import { allTasks } from '@/lib/board';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import { STATUS_STYLES } from '@/components/board/status-styles';
import { useProject } from '../ProjectProvider';

export function AnalyticsView() {
  const { board } = useProject();

  const data = useMemo(() => {
    const tasks = allTasks(board);
    const total = tasks.length;
    const done = board.Done.length;
    const overdue = tasks.filter((t) => t.isOverdue).length;
    const assigned = tasks.filter((t) => t.assignee).length;

    const byAssignee = new Map<string, number>();
    for (const task of tasks) {
      if (!task.assignee) continue;
      byAssignee.set(task.assignee.name, (byAssignee.get(task.assignee.name) ?? 0) + 1);
    }
    const workload = [...byAssignee.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const maxWorkload = workload.reduce((m, r) => Math.max(m, r.count), 0);

    return {
      total,
      done,
      overdue,
      completion: total === 0 ? 0 : Math.round((done / total) * 100),
      overdueRate: total === 0 ? 0 : Math.round((overdue / total) * 100),
      assignedRate: total === 0 ? 0 : Math.round((assigned / total) * 100),
      workload,
      maxWorkload,
    };
  }, [board]);

  if (data.total === 0) {
    return <EmptyState title="Nothing to analyze yet" message="Add some tasks and analytics will appear here." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Completion donut */}
        <section className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-5">
          <Donut percent={data.completion} />
          <p className="mt-3 text-sm font-medium text-text">Completion</p>
          <p className="text-xs text-text-subtle">
            {data.done} of {data.total} done
          </p>
        </section>

        {/* Status distribution */}
        <section className="rounded-xl border border-border bg-surface p-5 md:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text">Status distribution</h2>
          <div className="flex flex-col gap-3">
            {STATUSES.map((status) => {
              const count = board[status].length;
              const pct = data.total === 0 ? 0 : Math.round((count / data.total) * 100);
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-text-muted">
                      <span className={clsx('h-2 w-2 rounded-full', STATUS_STYLES[status].dot)} aria-hidden="true" />
                      {status}
                    </span>
                    <span className="tabular-nums text-text-subtle">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={clsx('h-full rounded-full', STATUS_STYLES[status].bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Health tiles */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">Health</h2>
          <div className="flex flex-col gap-4">
            <Meter label="Overdue rate" percent={data.overdueRate} tone="danger" caption={`${data.overdue} overdue`} />
            <Meter label="Assigned" percent={data.assignedRate} tone="primary" caption={`${data.assignedRate}% have an owner`} />
          </div>
        </section>

        {/* Workload */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">Tasks per assignee</h2>
          {data.workload.length === 0 ? (
            <p className="text-sm text-text-subtle">No assigned tasks yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.workload.map((row) => (
                <li key={row.name} className="flex items-center gap-3">
                  <Avatar name={row.name} />
                  <span className="w-24 shrink-0 truncate text-sm text-text">{row.name}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${data.maxWorkload === 0 ? 0 : (row.count / data.maxWorkload) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-text-muted">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** A compact SVG completion ring. Uses semantic tokens via stroke utilities. */
function Donut({ percent }: { percent: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-surface-muted" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="stroke-success transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-text">{percent}%</span>
      </div>
    </div>
  );
}

function Meter({
  label,
  percent,
  tone,
  caption,
}: {
  label: string;
  percent: number;
  tone: 'danger' | 'primary';
  caption: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-text-muted">{label}</span>
        <span className="font-semibold tabular-nums text-text">{percent}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={clsx('h-full rounded-full', tone === 'danger' ? 'bg-danger' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-text-subtle">{caption}</p>
    </div>
  );
}
