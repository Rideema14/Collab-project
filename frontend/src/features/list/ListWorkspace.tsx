'use client';

import { useEffect } from 'react';
import {
  CalendarDays,
  GanttChartSquare,
  KanbanSquare,
  LayoutList,
  Mic,
  Search,
  Table2,
  Users,
  Waypoints,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveListId, setVoiceCaptureOpen } from '@/store/slices/uiSlice';
import { setViewPrefs, DEFAULT_PREFS, type ViewKind } from '@/store/slices/tasksSlice';
import { selectListById, selectPrefsByList, selectSpaceById } from '@/store/selectors';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/design/cn';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import { Spinner } from '@/components/ui/Spinner';
// Board is the default view — keep it eager so the first paint is instant. The
// other views, the task drawer, and the voice modal are code-split and load on
// demand, so opening a list ships far less JS up front.
import { BoardView, StatusManagerButton } from '@/features/views/BoardView';
import { useListData } from './useListData';

const ViewLoading = () => (
  <div className="grid h-full place-items-center">
    <Spinner size="lg" label="Loading view" className="text-primary" />
  </div>
);

const ListView = dynamic(() => import('@/features/views/ListView').then((m) => ({ default: m.ListView })), {
  loading: ViewLoading,
});
const TableView = dynamic(() => import('@/features/views/TableView').then((m) => ({ default: m.TableView })), {
  loading: ViewLoading,
});
const CalendarView = dynamic(
  () => import('@/features/views/CalendarView').then((m) => ({ default: m.CalendarView })),
  { loading: ViewLoading }
);
const WorkloadView = dynamic(
  () => import('@/features/views/WorkloadView').then((m) => ({ default: m.WorkloadView })),
  { loading: ViewLoading }
);
const TimelineView = dynamic(
  () => import('@/features/views/TimelineView').then((m) => ({ default: m.TimelineView })),
  { loading: ViewLoading }
);
const TaskDetailDrawer = dynamic(() =>
  import('@/features/task/TaskDetailDrawer').then((m) => ({ default: m.TaskDetailDrawer }))
);
const VoiceCaptureModal = dynamic(() =>
  import('@/features/task/VoiceCaptureModal').then((m) => ({ default: m.VoiceCaptureModal }))
);

const VIEW_TABS: { key: ViewKind; label: string; icon: typeof KanbanSquare }[] = [
  { key: 'board', label: 'Board', icon: KanbanSquare },
  { key: 'list', label: 'List', icon: LayoutList },
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'timeline', label: 'Timeline', icon: Waypoints },
  { key: 'workload', label: 'Workload', icon: Users },
  { key: 'gantt', label: 'Gantt', icon: GanttChartSquare },
];

export function ListWorkspace({ listId }: { listId: string }) {
  const dispatch = useAppDispatch();
  const list = useAppSelector(selectListById(listId));
  const space = useAppSelector(selectSpaceById(list?.spaceId ?? ''));
  const prefs = useAppSelector(selectPrefsByList)[listId] ?? DEFAULT_PREFS;
  const { isLoading, allTasks } = useListData(listId);

  useEffect(() => {
    dispatch(setActiveListId(listId));
    return () => {
      dispatch(setActiveListId(null));
    };
  }, [dispatch, listId]);

  const set = (changes: Parameters<typeof setViewPrefs>[0]['changes']) =>
    dispatch(setViewPrefs({ listId, changes }));

  if (!list) {
    return <EmptyState title="List not found" message="This list doesn't exist in your workspace." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 pt-3">
        <div className="flex items-center gap-2 text-xs text-text-subtle">
          <span>{space?.icon}</span>
          <span>{space?.name}</span>
          <span>/</span>
          <span className="font-medium text-text-muted">{list.name}</span>
        </div>
        <h1 className="mt-1 text-lg font-semibold text-text">{list.name}</h1>

        {/* View tabs */}
        <div className="mt-2 flex items-center gap-1 overflow-x-auto">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = prefs.view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => set({ view: tab.key })}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-text'
                    : 'border-transparent text-text-muted hover:text-text'
                )}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <Input
            value={prefs.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search tasks…"
            className="h-8 w-48 pl-8"
          />
        </div>

        <Select
          label="Group"
          value={prefs.groupBy}
          onChange={(v) => set({ groupBy: v as typeof prefs.groupBy })}
          options={[['status', 'Status'], ['assignee', 'Assignee'], ['priority', 'Priority']]}
        />
        <Select
          label="Sort"
          value={prefs.sortBy}
          onChange={(v) => set({ sortBy: v as typeof prefs.sortBy })}
          options={[['manual', 'Manual'], ['due', 'Due date'], ['priority', 'Priority'], ['title', 'Name']]}
        />

        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          <input type="checkbox" checked={prefs.showDone} onChange={(e) => set({ showDone: e.target.checked })} />
          Show done
        </label>

        <div className="ml-auto flex items-center gap-1">
          <IconButton
            aria-label="Add task by voice"
            onClick={() => dispatch(setVoiceCaptureOpen(true))}
          >
            <Mic className="h-4 w-4" />
          </IconButton>
          <IconButton
            aria-label="Toggle density"
            active={prefs.density === 'compact'}
            onClick={() => set({ density: prefs.density === 'compact' ? 'comfortable' : 'compact' })}
          >
            <LayoutList className="h-4 w-4" />
          </IconButton>
          <StatusManagerButton listId={listId} />
        </div>
      </div>

      {/* View body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading && allTasks.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-subtle">Loading tasks…</p>
        ) : (
          <ViewSwitch view={prefs.view} listId={listId} />
        )}
      </div>

      <TaskDetailDrawer listId={listId} />
      <VoiceCaptureModal listId={listId} />
    </div>
  );
}

function ViewSwitch({ view, listId }: { view: ViewKind; listId: string }) {
  switch (view) {
    case 'board':
      return <BoardView listId={listId} />;
    case 'list':
      return <ListView listId={listId} />;
    case 'table':
      return <TableView listId={listId} />;
    case 'calendar':
      return <CalendarView listId={listId} />;
    case 'workload':
      return <WorkloadView listId={listId} />;
    case 'timeline':
      return <TimelineView listId={listId} mode="timeline" />;
    case 'gantt':
      return <TimelineView listId={listId} mode="gantt" />;
    default:
      return <BoardView listId={listId} />;
  }
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-text-subtle">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
