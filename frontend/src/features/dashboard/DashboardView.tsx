'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderKanban,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAllActivity, selectTimeEntries, selectWidgets } from '@/store/selectors';
import { addWidget, moveWidget, removeWidget, resetWidgets, type WidgetType } from '@/store/slices/dashboardSlice';
import { useAuth } from '@/lib/auth-context';
import { relativeTime, formatDuration } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Skeleton } from '@/components/ui/Misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Avatar } from '@/components/domain/AvatarStack';
import { Ring, Sparkbars, Meter } from '@/components/domain/Charts';
import { useWorkspaceStats, type WorkspaceStats } from './useWorkspaceStats';

const WIDGET_META: Record<WidgetType, { title: string; span: 1 | 2 }> = {
  kpi_projects: { title: 'Projects', span: 1 },
  kpi_tasks: { title: 'Total tasks', span: 1 },
  kpi_completed: { title: 'Completed', span: 1 },
  kpi_overdue: { title: 'Overdue', span: 1 },
  completion_ring: { title: 'Project health', span: 1 },
  created_trend: { title: 'Created this week', span: 1 },
  status_distribution: { title: 'Status distribution', span: 1 },
  team_workload: { title: 'Team workload', span: 2 },
  recent_activity: { title: 'Recent activity', span: 2 },
  time_tracked: { title: 'Time tracked', span: 1 },
  my_tasks: { title: 'My tasks', span: 1 },
};

const ALL_TYPES = Object.keys(WIDGET_META) as WidgetType[];

export function DashboardView() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const { stats, loading } = useWorkspaceStats();
  const activity = useAppSelector(selectAllActivity);
  const timeEntries = useAppSelector(selectTimeEntries);
  const widgets = useAppSelector(selectWidgets);
  const [editing, setEditing] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const totalTime = timeEntries.reduce((s, e) => s + e.minutes, 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-text-subtle">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-brand text-[10px] text-white">◆</span>
              Dashboard
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-text">
              {greeting}
              {user ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-1 text-sm text-text-muted">Here&apos;s how work is moving across your workspace.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {editing && (
              <>
                <AddWidgetMenu existing={widgets.map((w) => w.type)} onAdd={(t) => dispatch(addWidget(t))} />
                <button
                  type="button"
                  onClick={() => dispatch(resetWidgets())}
                  className="grid h-9 w-9 place-items-center rounded-xl text-text-muted transition-colors hover:bg-glass-border hover:text-text"
                  aria-label="Reset widgets"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
                editing ? 'bg-primary text-primary-fg' : 'border border-border text-text-muted hover:bg-glass-border hover:text-text'
              )}
            >
              <Pencil className="h-4 w-4" /> {editing ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {widgets.map((w, i) => (
            <WidgetCard
              key={w.id}
              title={WIDGET_META[w.type].title}
              span={WIDGET_META[w.type].span}
              editing={editing}
              canLeft={i > 0}
              canRight={i < widgets.length - 1}
              onMoveLeft={() => dispatch(moveWidget({ id: w.id, dir: -1 }))}
              onMoveRight={() => dispatch(moveWidget({ id: w.id, dir: 1 }))}
              onRemove={() => dispatch(removeWidget(w.id))}
            >
              <WidgetBody type={w.type} stats={stats} loading={loading} activity={activity} totalTime={totalTime} userName={user?.name} />
            </WidgetCard>
          ))}
          {widgets.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-text-subtle">
              No widgets. Click <strong>Edit</strong> → <strong>Add widget</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AddWidgetMenu({ existing, onAdd }: { existing: WidgetType[]; onAdd: (t: WidgetType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm text-text-muted transition-colors hover:bg-glass-border hover:text-text">
          <Plus className="h-4 w-4" /> Add widget
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {ALL_TYPES.map((t) => (
          <DropdownMenuItem key={t} onSelect={() => onAdd(t)}>
            {WIDGET_META[t].title}
            {existing.includes(t) && <span className="ml-auto text-xs text-text-subtle">added</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WidgetCard({
  title,
  span,
  editing,
  canLeft,
  canRight,
  onMoveLeft,
  onMoveRight,
  onRemove,
  children,
}: {
  title: string;
  span: 1 | 2;
  editing: boolean;
  canLeft: boolean;
  canRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('relative rounded-2xl border border-glass-border bg-glass p-4 shadow-glass', span === 2 && 'lg:col-span-2')}>
      {editing && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised/90 p-0.5 backdrop-blur">
          <button type="button" onClick={onMoveLeft} disabled={!canLeft} className="grid h-6 w-6 place-items-center rounded text-text-subtle hover:bg-surface-muted disabled:opacity-30" aria-label="Move left"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={onMoveRight} disabled={!canRight} className="grid h-6 w-6 place-items-center rounded text-text-subtle hover:bg-surface-muted disabled:opacity-30" aria-label="Move right"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={onRemove} className="grid h-6 w-6 place-items-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger" aria-label="Remove"><X className="h-4 w-4" /></button>
        </div>
      )}
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-subtle">{title}</p>
      {children}
    </section>
  );
}

const KPI_ICON = { kpi_projects: FolderKanban, kpi_tasks: ListTodo, kpi_completed: CheckCircle2, kpi_overdue: AlertTriangle } as const;

function WidgetBody({
  type,
  stats,
  loading,
  activity,
  totalTime,
  userName,
}: {
  type: WidgetType;
  stats: WorkspaceStats;
  loading: boolean;
  activity: { id: string; message: string; at: string }[];
  totalTime: number;
  userName?: string;
}) {
  if (type.startsWith('kpi_')) {
    const map: Record<string, { value: number; tone: string }> = {
      kpi_projects: { value: stats.totalProjects, tone: 'text-primary' },
      kpi_tasks: { value: stats.totalTasks, tone: 'text-accent' },
      kpi_completed: { value: stats.completed, tone: 'text-success' },
      kpi_overdue: { value: stats.overdue, tone: stats.overdue > 0 ? 'text-danger' : 'text-text-muted' },
    };
    const Icon = KPI_ICON[type as keyof typeof KPI_ICON];
    const d = map[type];
    return (
      <div className="flex items-end justify-between">
        {loading ? <Skeleton className="h-8 w-16" /> : <p className={cn('text-3xl font-semibold tabular-nums', d.tone)}>{d.value}</p>}
        <Icon className={cn('h-5 w-5', d.tone)} />
      </div>
    );
  }

  switch (type) {
    case 'completion_ring':
      return (
        <div className="flex items-center gap-4">
          <Ring percent={stats.completionPct}>
            <div className="text-center">
              <p className="text-xl font-semibold text-text">{stats.completionPct}%</p>
              <p className="text-[10px] uppercase tracking-wide text-text-subtle">done</p>
            </div>
          </Ring>
          <div className="flex-1 space-y-1.5 text-sm">
            <Row label="Active" value={stats.active} />
            <Row label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'text-danger' : undefined} />
            <Row label="Unassigned" value={stats.unassigned} />
          </div>
        </div>
      );
    case 'created_trend':
      return loading ? <Skeleton className="h-24 w-full" /> : <Sparkbars data={stats.createdTrend} />;
    case 'status_distribution':
      return stats.byStatus.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-2">
          {stats.byStatus.slice(0, 6).map((s) => (
            <div key={s.name}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="text-text-muted">{s.name}</span>
                <span className="tabular-nums text-text-subtle">{s.count}</span>
              </div>
              <Meter value={s.count} max={stats.totalTasks} />
            </div>
          ))}
        </div>
      );
    case 'team_workload':
      return stats.byAssignee.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-2.5">
          {stats.byAssignee.slice(0, 6).map((r) => {
            const isUn = r.name === 'Unassigned';
            const max = stats.byAssignee[0]?.count ?? 1;
            return (
              <li key={r.name} className="flex items-center gap-3">
                {isUn ? (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-glass-border text-xs text-text-subtle">?</span>
                ) : (
                  <Avatar person={{ id: hashId(r.name), name: r.name }} size={28} />
                )}
                <span className="w-28 shrink-0 truncate text-sm text-text">{r.name}</span>
                <Meter value={r.count} max={max} className="flex-1" color={isUn ? 'var(--color-border-strong)' : 'var(--gradient-brand)'} />
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-text-subtle">{r.done}/{r.count}</span>
              </li>
            );
          })}
        </ul>
      );
    case 'recent_activity':
      return activity.length === 0 ? (
        <Empty text="No activity yet" />
      ) : (
        <ul className="space-y-1">
          {activity.slice(0, 8).map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-glass">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 truncate text-text-muted">You {a.message}</span>
              <span className="shrink-0 text-xs text-text-subtle">{relativeTime(a.at)}</span>
            </li>
          ))}
        </ul>
      );
    case 'time_tracked':
      return (
        <div className="flex items-end justify-between">
          <p className="text-3xl font-semibold tabular-nums text-primary">{formatDuration(totalTime)}</p>
          <Clock className="h-5 w-5 text-primary" />
        </div>
      );
    case 'my_tasks': {
      const mine = stats.byAssignee.find((a) => a.name === userName);
      return (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-accent">{mine ? mine.count - mine.done : 0}</p>
            <p className="text-xs text-text-subtle">active assigned to you</p>
          </div>
          <User className="h-5 w-5 text-accent" />
        </div>
      );
    }
    default:
      return null;
  }
}

function Row({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={cn('font-semibold tabular-nums', tone ?? 'text-text')}>{value}</span>
    </div>
  );
}

function Empty({ text = 'No data yet' }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-text-subtle">{text}</p>;
}

function hashId(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default DashboardView;
