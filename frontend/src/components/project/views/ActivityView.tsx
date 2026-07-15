'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { relativeTime } from '@/lib/format';
import { useAppSelector } from '@/store/hooks';
import { selectAllActivity } from '@/store/selectors';
import type { ActivityEntry, ActivityKind } from '@/store/slices/activitySlice';
import { EmptyState } from '@/components/ui/States';
import { useProject } from '../ProjectProvider';

const KIND_STYLE: Record<ActivityKind, { icon: string; ring: string; text: string }> = {
  created: { icon: '+', ring: 'bg-success-soft text-success-fg', text: 'created' },
  updated: { icon: '✎', ring: 'bg-primary-soft text-primary-on-soft', text: 'updated' },
  moved: { icon: '→', ring: 'bg-warning-soft text-warning-fg', text: 'moved' },
  deleted: { icon: '✕', ring: 'bg-danger-soft text-danger-fg', text: 'deleted' },
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ActivityView() {
  const { projectId } = useProject();
  const all = useAppSelector(selectAllActivity);

  const groups = useMemo(() => {
    const mine = all.filter((entry) => entry.projectId === projectId);
    const buckets: { label: string; entries: ActivityEntry[] }[] = [];
    for (const entry of mine) {
      const label = dayLabel(entry.at);
      const last = buckets[buckets.length - 1];
      if (last && last.label === label) last.entries.push(entry);
      else buckets.push({ label, entries: [entry] });
    }
    return buckets;
  }, [all, projectId]);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        message="As you create, move, edit, and delete tasks in this project, a running history appears here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {group.label}
          </h2>
          <ul className="flex flex-col">
            {group.entries.map((entry, index) => {
              const style = KIND_STYLE[entry.kind];
              const isLast = index === group.entries.length - 1;
              return (
                <li key={entry.id} className="flex gap-3">
                  {/* Timeline rail */}
                  <div className="flex flex-col items-center">
                    <span
                      aria-hidden="true"
                      className={clsx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        style.ring
                      )}
                    >
                      {style.icon}
                    </span>
                    {!isLast && <span className="w-px flex-1 bg-border" />}
                  </div>

                  <div className={clsx('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-5')}>
                    <p className="text-sm text-text">
                      <span className="font-medium capitalize">{style.text}</span>{' '}
                      <span className="text-text-muted">{stripVerb(entry.message)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-text-subtle">{relativeTime(entry.at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The stored message reads "Moved “X” to Done"; the row already shows the verb as
 * a coloured chip, so drop the leading verb to avoid saying it twice.
 */
function stripVerb(message: string): string {
  return message.replace(/^(Created|Updated|Moved|Deleted)\s+/i, '');
}
