'use client';

import { useEffect, useMemo, useState } from 'react';
import { backendApi, useGetProjectsQuery, type DynamicBoard } from '@/store/api/backendApi';
import { useAppSelector, useAppStore } from '@/store/hooks';
import { selectStatusSets } from '@/store/selectors';
import { dateOnly } from '@/lib/format';
import type { Project, Task } from '@/lib/types';
import type { StatusSet } from '@/lib/domain/types';

export interface WorkspaceStats {
  totalProjects: number;
  totalTasks: number;
  completed: number;
  overdue: number;
  unassigned: number;
  completionPct: number;
  /** Non-done tasks, i.e. work still in flight. */
  active: number;
  byAssignee: { name: string; count: number; done: number }[];
  byStatus: { name: string; count: number }[];
  /** Tasks created per day over the last 7 days (oldest → newest). */
  createdTrend: { label: string; count: number }[];
  /** Rough "at current pace" days-to-clear the backlog, or null when idle. */
  forecastDays: number | null;
}

/** Names of every status in a 'done' group across all sets, plus the literal 'Done'. */
function doneStatusNames(sets: Record<string, StatusSet>): Set<string> {
  const names = new Set<string>(['Done']);
  for (const set of Object.values(sets)) {
    for (const s of set.statuses) if (s.group === 'done') names.add(s.name);
  }
  return names;
}

function aggregate(
  projects: Project[],
  boards: Record<number, DynamicBoard>,
  sets: Record<string, StatusSet>
): WorkspaceStats {
  const done = doneStatusNames(sets);
  const tasks: Task[] = Object.values(boards).flatMap((b) => Object.values(b).flat());

  const total = tasks.length;
  const completed = tasks.filter((t) => done.has(t.status)).length;
  const overdue = tasks.filter((t) => t.isOverdue).length;
  const unassigned = tasks.filter((t) => !t.assignee).length;

  const assignee = new Map<string, { count: number; done: number }>();
  const status = new Map<string, number>();
  for (const t of tasks) {
    const key = t.assignee?.name ?? 'Unassigned';
    const a = assignee.get(key) ?? { count: 0, done: 0 };
    a.count += 1;
    if (done.has(t.status)) a.done += 1;
    assignee.set(key, a);
    status.set(t.status, (status.get(t.status) ?? 0) + 1);
  }

  // 7-day creation trend (local calendar days).
  const trend: { label: string; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const count = tasks.filter((t) => dateOnly(t.createdAt) === key).length;
    trend.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), count });
  }

  const active = total - completed;
  const recentDoneRate = completed / Math.max(total, 1);
  const forecastDays = active > 0 && recentDoneRate > 0 ? Math.ceil(active / Math.max(completed / 7, 0.5)) : null;

  return {
    totalProjects: projects.length,
    totalTasks: total,
    completed,
    overdue,
    unassigned,
    active,
    completionPct: total === 0 ? 0 : Math.round((completed / total) * 100),
    byAssignee: [...assignee.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count),
    byStatus: [...status.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    createdTrend: trend,
    forecastDays,
  };
}

/**
 * Aggregates real task data across EVERY project's board. Boards are fetched via
 * RTK Query's imperative `initiate` (one subscription per project, cleaned up on
 * unmount) so the dashboard reflects live server data, not a snapshot.
 */
export function useWorkspaceStats() {
  const store = useAppStore();
  const statusSets = useAppSelector(selectStatusSets);
  const { data: projects, isLoading: projectsLoading } = useGetProjectsQuery();
  const [boards, setBoards] = useState<Record<number, DynamicBoard>>({});
  const [boardsLoading, setBoardsLoading] = useState(true);

  useEffect(() => {
    if (!projects) return;
    let cancelled = false;
    setBoardsLoading(true);
    const subs = projects.map((p) => store.dispatch(backendApi.endpoints.getBoard.initiate(p.id)));
    Promise.all(subs.map((s) => s.unwrap().catch(() => ({}) as DynamicBoard))).then((results) => {
      if (cancelled) return;
      const map: Record<number, DynamicBoard> = {};
      projects.forEach((p, i) => (map[p.id] = results[i]));
      setBoards(map);
      setBoardsLoading(false);
    });
    return () => {
      cancelled = true;
      subs.forEach((s) => s.unsubscribe());
    };
  }, [projects, store]);

  const stats = useMemo(
    () => aggregate(projects ?? [], boards, statusSets),
    [projects, boards, statusSets]
  );

  return { stats, loading: projectsLoading || boardsLoading, projects: projects ?? [] };
}
