'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderKanban,
  LayoutGrid,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  Target,
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
import { Button } from '@/components/ui/Button';
import { FadeInUp, HoverCard, Stagger, StaggerItem } from '@/components/ui/Motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Avatar } from '@/components/domain/AvatarStack';
import { Ring, Sparkbars, Meter } from '@/components/domain/Charts';
import { statusColors, DATAVIZ_HUES } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { useWorkspaceStats, type WorkspaceStats } from './useWorkspaceStats';

const WIDGET_META: Record<WidgetType, { title: string; span: 1 | 2 | 3 | 4; icon: any }> = {
  kpi_projects: { title: 'Active Projects', span: 1, icon: FolderKanban },
  kpi_tasks: { title: 'Total Tasks', span: 1, icon: ListTodo },
  kpi_completed: { title: 'Completed', span: 1, icon: CheckCircle2 },
  kpi_overdue: { title: 'Overdue', span: 1, icon: AlertTriangle },
  completion_ring: { title: 'Completion', span: 2, icon: Target },
  created_trend: { title: 'Tasks Created', span: 2, icon: Activity },
  status_distribution: { title: 'Status Breakdown', span: 2, icon: ListTodo },
  team_workload: { title: 'Team Workload', span: 4, icon: User },
  recent_activity: { title: 'Recent Activity', span: 4, icon: Activity },
  time_tracked: { title: 'Time Tracked', span: 1, icon: Clock },
  my_tasks: { title: 'My Tasks', span: 1, icon: User },
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
    <div className="h-full w-full overflow-y-auto bg-bg text-text antialiased">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-12">
        <FadeInUp className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting}
              {user ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-text-muted">
              Here&rsquo;s an overview of your team&rsquo;s work.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {editing && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <AddWidgetMenu existing={widgets.map((w) => w.type)} onAdd={(t) => dispatch(addWidget(t))} />
                <button
                  type="button"
                  onClick={() => dispatch(resetWidgets())}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-text-muted shadow-sm transition-colors hover:bg-surface-muted hover:text-text"
                  title="Reset to default layout"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={cn(
                'flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors active:scale-[0.98]',
                editing
                  ? 'bg-text text-bg hover:opacity-90'
                  : 'border border-border bg-surface text-text shadow-sm hover:bg-surface-muted'
              )}
            >
              <Pencil className={cn('h-4 w-4 transition-transform', editing && 'rotate-45')} />
              {editing ? 'Save layout' : 'Customize board'}
            </button>
          </div>
        </FadeInUp>

        <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
          {widgets.map((w, i) => {
            const meta = WIDGET_META[w.type];
            return (
              <StaggerItem
                key={w.id}
                className={cn(
                  'h-full',
                  meta.span === 2 && 'sm:col-span-2 lg:col-span-2',
                  meta.span === 3 && 'sm:col-span-2 lg:col-span-3',
                  meta.span === 4 && 'col-span-full'
                )}
              >
                <WidgetCard
                  title={meta.title}
                  icon={meta.icon}
                  editing={editing}
                  canLeft={i > 0}
                  canRight={i < widgets.length - 1}
                  onMoveLeft={() => dispatch(moveWidget({ id: w.id, dir: -1 }))}
                  onMoveRight={() => dispatch(moveWidget({ id: w.id, dir: 1 }))}
                  onRemove={() => dispatch(removeWidget(w.id))}
                >
                  <WidgetBody
                    type={w.type}
                    stats={stats}
                    loading={loading}
                    activity={activity}
                    totalTime={totalTime}
                    userName={user?.name}
                  />
                </WidgetCard>
              </StaggerItem>
            );
          })}

          {widgets.length === 0 && (
            <StaggerItem className="col-span-full">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong py-20 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
                  <LayoutGrid className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-base font-bold text-text">No widgets yet</h3>
                <p className="mt-1 max-w-xs text-xs text-text-muted">
                  Add widgets to build a dashboard that fits how your team works.
                </p>
                <Button variant="primary" size="md" className="mt-4" onClick={() => setEditing(true)}>
                  Customize board
                </Button>
              </div>
            </StaggerItem>
          )}
        </Stagger>
      </div>
    </div>
  );
}

function AddWidgetMenu({ existing, onAdd }: { existing: WidgetType[]; onAdd: (t: WidgetType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-bold text-text shadow-sm transition-colors hover:bg-surface-muted"
        >
          <Plus className="h-4 w-4 text-primary" /> Add widget
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto rounded-xl border border-border bg-surface p-1.5">
        {ALL_TYPES.map((t) => {
          const Icon = WIDGET_META[t].icon;
          return (
            <DropdownMenuItem
              key={t}
              onSelect={() => onAdd(t)}
              className="flex cursor-pointer items-center gap-3.5 rounded-lg px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-muted"
            >
              <Icon className="h-4 w-4 text-text-subtle" />
              <span className="flex-1 truncate">{WIDGET_META[t].title}</span>
              {existing.includes(t) && (
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                  Added
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WidgetCard({
  title,
  icon: Icon,
  editing,
  canLeft,
  canRight,
  onMoveLeft,
  onMoveRight,
  onRemove,
  children,
}: {
  title: string;
  icon: any;
  editing: boolean;
  canLeft: boolean;
  canRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <HoverCard lift={!editing} className="h-full">
      <section
        className={cn(
          'group relative flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition-colors duration-200 hover:border-border-strong',
          editing && 'ring-2 ring-dashed ring-border-strong scale-[0.99] select-none hover:ring-primary'
        )}
      >
        {editing && (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-border bg-surface/95 p-1 shadow-md backdrop-blur-md animate-in zoom-in-95 duration-150">
            <button type="button" onClick={onMoveLeft} disabled={!canLeft} className="flex h-6 w-6 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted disabled:opacity-25" aria-label="Move left"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={onMoveRight} disabled={!canRight} className="flex h-6 w-6 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted disabled:opacity-25" aria-label="Move right"><ChevronRight className="h-4 w-4" /></button>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <button type="button" onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded-lg text-text-subtle hover:bg-danger-soft hover:text-danger" aria-label="Remove widget"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-text-subtle">{title}</p>
            {!editing && Icon && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <div className="relative w-full">{children}</div>
        </div>
      </section>
    </HoverCard>
  );
}

/** Neutral counts (projects, tasks) get a solid brand tint; color is reserved for status that matters. */
const KPI_TONES = {
  kpi_projects: { icon: FolderKanban, color: 'text-text-muted', bg: 'bg-surface-muted', number: 'text-primary' },
  kpi_tasks: { icon: ListTodo, color: 'text-text-muted', bg: 'bg-surface-muted', number: 'text-primary' },
  kpi_completed: { icon: CheckCircle2, color: 'text-success-fg', bg: 'bg-success-soft', number: 'text-success-fg' },
  kpi_overdue: { icon: AlertTriangle, color: 'text-danger-fg', bg: 'bg-danger-soft', number: 'text-danger-fg' },
} as const;

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
  const { theme } = useTheme();

  if (type.startsWith('kpi_')) {
    const context = KPI_TONES[type as keyof typeof KPI_TONES];
    const valueMap: Record<string, number> = {
      kpi_projects: stats.totalProjects,
      kpi_tasks: stats.totalTasks,
      kpi_completed: stats.completed,
      kpi_overdue: stats.overdue,
    };
    const finalValue = valueMap[type] ?? 0;

    return (
      <div className="flex items-center justify-between">
        {loading ? (
          <Skeleton className="h-9 w-20 rounded-lg" />
        ) : (
          <p className={cn('font-display text-4xl font-bold tracking-tight tabular-nums', context.number)}>{finalValue}</p>
        )}
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', context.bg)}>
          <context.icon className={cn('h-6 w-6', context.color)} />
        </div>
      </div>
    );
  }

  switch (type) {
    case 'completion_ring':
      return (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative flex shrink-0 justify-center">
            <Ring percent={stats.completionPct} size={100} stroke={8}>
              <div className="text-center">
                <p className="font-display text-2xl font-bold tracking-tight">{stats.completionPct}%</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">Complete</p>
              </div>
            </Ring>
          </div>
          <div className="flex-1 space-y-2.5">
            <Row label="In progress" value={stats.active} statusColor="bg-primary" />
            <Row label="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'text-danger font-bold' : undefined} statusColor="bg-danger" />
            <Row label="Unassigned" value={stats.unassigned} statusColor="bg-border-strong" />
          </div>
        </div>
      );

    case 'created_trend':
      return loading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : (
        <div className="pt-2">
          <Sparkbars data={stats.createdTrend} />
        </div>
      );

    case 'status_distribution':
      return stats.byStatus.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.byStatus.slice(0, 6).map((s, idx) => (
            <div
              key={s.name}
              className="rounded-xl border border-border bg-surface-muted/50 p-3 transition-colors duration-200 hover:border-border-strong"
            >
              <div className="mb-1.5 flex justify-between text-xs font-bold">
                <span className="text-text-muted">{s.name}</span>
                <span className="tabular-nums">{s.count}</span>
              </div>
              <Meter
                value={s.count}
                max={stats.totalTasks}
                className="h-2 rounded-full"
                color={statusColors(DATAVIZ_HUES[idx % DATAVIZ_HUES.length], theme).solid}
              />
            </div>
          ))}
        </div>
      );

    case 'team_workload':
      return stats.byAssignee.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stats.byAssignee.slice(0, 6).map((r, idx) => {
            const isUn = r.name === 'Unassigned';
            const max = stats.byAssignee[0]?.count ?? 1;
            return (
              <div
                key={r.name}
                className="flex items-center gap-3.5 rounded-xl border border-border p-3 transition-colors duration-200 hover:border-border-strong hover:bg-surface-muted/40"
              >
                <div className="relative shrink-0">
                  {isUn ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-black text-text-subtle">?</span>
                  ) : (
                    <Avatar person={{ id: hashId(r.name), name: r.name }} size={32} />
                  )}
                  {idx === 0 && !isUn && r.count > 0 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-black text-primary-fg ring-2 ring-surface"
                      title="Top contributor"
                    >
                      1
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-xs font-bold">
                    <span className="truncate text-text">{r.name}</span>
                    <span className="tabular-nums text-text-muted">{r.done}/{r.count}</span>
                  </div>
                  <Meter
                    value={r.count}
                    max={max}
                    color={isUn ? 'var(--color-text-subtle)' : statusColors(DATAVIZ_HUES[idx % DATAVIZ_HUES.length], theme).solid}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );

    case 'recent_activity':
      return activity.length === 0 ? (
        <Empty text="No activity yet" />
      ) : (
        <div className="max-h-[320px] overflow-y-auto pr-1">
          <ul className="divide-y divide-border">
            {activity.slice(0, 10).map((a) => (
              <li key={a.id} className="group flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-surface-muted">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-2 w-2 shrink-0 rounded-full bg-primary ring-4 ring-primary-soft" />
                  <p className="truncate text-sm font-medium text-text-muted">
                    <span className="font-bold text-text">You</span> {a.message}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-text-subtle">{relativeTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'time_tracked':
      return (
        <div className="flex items-center justify-between">
          <p className="font-display text-4xl font-bold tracking-tight text-primary tabular-nums">{formatDuration(totalTime)}</p>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft">
            <Clock className="h-6 w-6 text-primary" />
          </div>
        </div>
      );

    case 'my_tasks': {
      const mine = stats.byAssignee.find((a) => a.name === userName);
      const activeCount = mine ? mine.count - mine.done : 0;
      return (
        <div className="flex items-center justify-between">
          <p className="font-display text-4xl font-bold tracking-tight text-primary tabular-nums">{activeCount}</p>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft">
            <User className="h-6 w-6 text-primary" />
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

function Row({ label, value, tone, statusColor }: { label: string; value: number; tone?: string; statusColor?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5 text-sm">
      <div className="flex items-center gap-2">
        {statusColor && <span className={cn('h-2 w-2 rounded-full', statusColor)} />}
        <span className="font-medium text-text-muted">{label}</span>
      </div>
      <span className={cn('font-bold tabular-nums text-text', tone)}>{value}</span>
    </div>
  );
}

function Empty({ text = 'Nothing here yet' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <BarChart3 className="mb-1 h-5 w-5 text-text-subtle" />
      <p className="mt-1 text-xs font-bold text-text-subtle">{text}</p>
    </div>
  );
}

function hashId(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default DashboardView;

