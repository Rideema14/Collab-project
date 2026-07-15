'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  TrendingUp,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectAllActivity } from '@/store/selectors';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Stagger, StaggerItem } from '@/components/ui/Motion';
import { Skeleton } from '@/components/ui/Misc';
import { Avatar } from '@/components/domain/AvatarStack';
import { Ring, Sparkbars, Meter } from '@/components/domain/Charts';
import { useWorkspaceStats } from './useWorkspaceStats';

export function DashboardView() {
  const { user } = useAuth();
  const { stats, loading } = useWorkspaceStats();
  const activity = useAppSelector(selectAllActivity).slice(0, 8);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-1 flex items-center gap-2 text-sm text-text-subtle">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-brand text-[10px] text-white">◆</span>
          Dashboard
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-text">
          {greeting}
          {user ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-text-muted">Here&apos;s how work is moving across your workspace.</p>

        {/* KPI row */}
        <Stagger className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4" stagger={0.06}>
          <Kpi icon={FolderKanban} label="Projects" value={stats.totalProjects} loading={loading} tone="primary" />
          <Kpi icon={ListTodo} label="Total tasks" value={stats.totalTasks} loading={loading} tone="accent" />
          <Kpi icon={CheckCircle2} label="Completed" value={stats.completed} loading={loading} tone="success" />
          <Kpi icon={AlertTriangle} label="Overdue" value={stats.overdue} loading={loading} tone={stats.overdue > 0 ? 'danger' : 'muted'} />
        </Stagger>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Project health */}
          <Panel title="Project health" icon={Activity} className="lg:col-span-1">
            <div className="flex items-center gap-5">
              <Ring percent={stats.completionPct}>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-text">{stats.completionPct}%</p>
                  <p className="text-[10px] uppercase tracking-wide text-text-subtle">done</p>
                </div>
              </Ring>
              <div className="flex-1 space-y-3 text-sm">
                <HealthRow label="Active" value={stats.active} />
                <HealthRow label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : undefined} />
                <HealthRow label="Unassigned" value={stats.unassigned} />
                {stats.forecastDays != null && (
                  <div className="rounded-lg bg-glass px-2.5 py-1.5 text-xs text-text-muted">
                    <TrendingUp className="mr-1 inline h-3.5 w-3.5 text-primary" />
                    ~{stats.forecastDays}d to clear at current pace
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* 7-day creation trend */}
          <Panel title="Created this week" icon={TrendingUp} className="lg:col-span-1">
            {loading ? <Skeleton className="h-24 w-full" /> : <Sparkbars data={stats.createdTrend} />}
          </Panel>

          {/* Status distribution */}
          <Panel title="Status distribution" icon={ListTodo} className="lg:col-span-1">
            {stats.byStatus.length === 0 ? (
              <Empty text="No tasks yet" />
            ) : (
              <div className="space-y-2.5">
                {stats.byStatus.slice(0, 6).map((s) => (
                  <div key={s.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-text-muted">{s.name}</span>
                      <span className="tabular-nums text-text-subtle">{s.count}</span>
                    </div>
                    <Meter value={s.count} max={stats.totalTasks} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Team workload */}
          <Panel title="Team workload" icon={Activity}>
            {stats.byAssignee.length === 0 ? (
              <Empty text="No assigned work yet" />
            ) : (
              <ul className="space-y-3">
                {stats.byAssignee.slice(0, 6).map((row) => {
                  const isUnassigned = row.name === 'Unassigned';
                  const maxCount = stats.byAssignee[0]?.count ?? 1;
                  return (
                    <li key={row.name} className="flex items-center gap-3">
                      {isUnassigned ? (
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-glass-border text-xs text-text-subtle">?</span>
                      ) : (
                        <Avatar person={{ id: hashId(row.name), name: row.name }} size={28} />
                      )}
                      <span className="w-28 shrink-0 truncate text-sm text-text">{row.name}</span>
                      <Meter value={row.count} max={maxCount} className="flex-1" color={isUnassigned ? 'var(--color-border-strong)' : 'var(--gradient-brand)'} />
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-text-subtle">
                        {row.done}/{row.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Recent activity */}
          <Panel title="Recent activity" icon={Activity}>
            {activity.length === 0 ? (
              <Empty text="No activity yet" />
            ) : (
              <ul className="space-y-1.5">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-glass">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="flex-1 truncate text-text-muted">You {a.message}</span>
                    <span className="shrink-0 text-xs text-text-subtle">{relativeTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-text-muted',
};

function Kpi({
  icon: Icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number;
  loading: boolean;
  tone: keyof typeof TONE;
}) {
  return (
    <StaggerItem className="group relative overflow-hidden rounded-2xl border border-glass-border bg-glass p-4 shadow-glass">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-brand opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">{label}</span>
        <Icon className={cn('h-4 w-4', TONE[tone])} />
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className={cn('mt-1.5 text-3xl font-semibold tabular-nums', TONE[tone])}>{value}</p>
      )}
    </StaggerItem>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-glass-border bg-glass p-5 shadow-glass', className)}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-subtle" />
        <h2 className="text-sm font-semibold text-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={cn('font-semibold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-text')}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-text-subtle">{text}</p>;
}

/** Stable pseudo-id from a name so avatars keep a consistent color. */
function hashId(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default DashboardView;
