'use client';

import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { selectMembersMeta } from '@/store/selectors';
import { cn } from '@/lib/design/cn';
import type { TaskVM } from '@/lib/domain/types';
import { Avatar } from '@/components/domain/AvatarStack';
import { StatusChip } from '@/components/domain/StatusChip';
import { useListData } from '@/features/list/useListData';

interface Lane {
  key: string;
  name: string;
  person: { id: number; name: string } | null;
  tasks: TaskVM[];
  estimateHours: number;
  capacity: number;
}

/** Capacity view — open (non-done) tasks per assignee against a weekly capacity. */
export function WorkloadView({ listId }: { listId: string }) {
  const { allTasks } = useListData(listId);
  const membersMeta = useAppSelector(selectMembersMeta);
  const dispatch = useAppDispatch();

  const lanes = useMemo<Lane[]>(() => {
    const map = new Map<string, Lane>();
    const ensure = (key: string, name: string, person: Lane['person']) =>
      map.get(key) ??
      map.set(key, { key, name, person, tasks: [], estimateHours: 0, capacity: person ? membersMeta[person.id]?.capacityHours ?? 40 : 0 }).get(key)!;

    for (const t of allTasks) {
      if (t.status.group === 'done') continue;
      const lane = t.assignee
        ? ensure(`u${t.assignee.id}`, t.assignee.name, { id: t.assignee.id, name: t.assignee.name })
        : ensure('unassigned', 'Unassigned', null);
      lane.tasks.push(t);
      lane.estimateHours += (t.rich.estimateMinutes ?? 120) / 60;
    }
    return Array.from(map.values()).sort((a, b) => b.estimateHours - a.estimateHours);
  }, [allTasks, membersMeta]);

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
      {lanes.map((lane) => {
        const pct = lane.capacity ? Math.min(100, (lane.estimateHours / lane.capacity) * 100) : 0;
        const over = lane.capacity > 0 && lane.estimateHours > lane.capacity;
        return (
          <div key={lane.key} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              {lane.person ? <Avatar person={lane.person} size={28} /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-xs text-text-subtle">?</span>}
              <span className="font-medium text-text">{lane.name}</span>
              <span className="ml-auto text-xs text-text-muted">
                {lane.tasks.length} tasks · {lane.estimateHours.toFixed(1)}h
                {lane.capacity ? ` / ${lane.capacity}h` : ''}
              </span>
            </div>
            {lane.capacity > 0 && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-primary')} style={{ width: `${pct}%` }} />
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lane.tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => dispatch(openTask(t.id))}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text hover:bg-surface-muted"
                >
                  <StatusChip status={t.status} />
                  <span className="max-w-[10rem] truncate">{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {lanes.length === 0 && <p className="py-10 text-center text-sm text-text-subtle">No open work to balance.</p>}
    </div>
  );
}
