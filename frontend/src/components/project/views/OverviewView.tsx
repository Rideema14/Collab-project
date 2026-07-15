'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { Task } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { allTasks } from '@/lib/board';
import { formatDueDate } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { STATUS_STYLES } from '@/components/board/status-styles';
import { useProject } from '../ProjectProvider';

export function OverviewView() {
  const { board, projectId } = useProject();

  const stats = useMemo(() => {
    const tasks = allTasks(board);
    const total = tasks.length;
    const done = board.Done.length;
    const overdue = tasks.filter((t) => t.isOverdue).length;
    const unassigned = tasks.filter((t) => !t.assignee).length;

    const byAssignee = new Map<string, number>();
    for (const task of tasks) {
      const key = task.assignee?.name ?? 'Unassigned';
      byAssignee.set(key, (byAssignee.get(key) ?? 0) + 1);
    }
    const workload = [...byAssignee.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const recent = [...tasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    const completion = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, overdue, unassigned, workload, recent, completion };
  }, [board]);

  return (
    <div className="flex flex-col gap-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total tasks" value={stats.total} />
        <StatTile label="Completed" value={stats.done} tone="success" />
        <StatTile label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : 'muted'} />
        <StatTile label="Unassigned" value={stats.unassigned} tone="muted" />
      </div>

      {/* Completion + column distribution */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold text-text">Progress</h2>
          <span className="text-sm text-text-muted">{stats.completion}% complete</span>
        </div>

        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500"
            style={{ width: `${stats.completion}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
              <span className={clsx('h-2 w-2 rounded-full', STATUS_STYLES[status].dot)} aria-hidden="true" />
              <span className="text-sm text-text-muted">{status}</span>
              <span className="ml-auto text-sm font-semibold tabular-nums text-text">
                {board[status].length}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Workload */}
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-text">Workload by assignee</h2>
          {stats.workload.length === 0 ? (
            <p className="text-sm text-text-subtle">No tasks yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {stats.workload.map((row) => {
                const pct = stats.total === 0 ? 0 : Math.round((row.count / stats.total) * 100);
                const isUnassigned = row.name === 'Unassigned';
                return (
                  <li key={row.name} className="flex items-center gap-3">
                    {isUnassigned ? (
                      <span
                        aria-hidden="true"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] text-text-subtle ring-1 ring-inset ring-border"
                      >
                        ?
                      </span>
                    ) : (
                      <Avatar name={row.name} />
                    )}
                    <span className="w-28 shrink-0 truncate text-sm text-text">{row.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <span
                        className={clsx('block h-full rounded-full', isUnassigned ? 'bg-border-strong' : 'bg-primary')}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-text-muted">
                      {row.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent tasks */}
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Recently added</h2>
            <Link
              href={`/projects/${projectId}/list`}
              className="rounded-sm text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-text-subtle">No tasks yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {stats.recent.map((task) => (
                <RecentRow key={task.id} task={task} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'danger' | 'muted';
}) {
  const valueTone =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'muted'
          ? 'text-text-muted'
          : 'text-text';
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">{label}</p>
      <p className={clsx('mt-1 text-2xl font-semibold tabular-nums', valueTone)}>{value}</p>
    </div>
  );
}

function RecentRow({ task }: { task: Task }) {
  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', STATUS_STYLES[task.status].dot)} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-text">{task.title}</span>
      {task.dueDate && (
        <span className={clsx('shrink-0 text-xs', task.isOverdue ? 'text-danger' : 'text-text-subtle')}>
          {formatDueDate(task.dueDate)}
        </span>
      )}
      {task.assignee && <Avatar name={task.assignee.name} />}
    </li>
  );
}
