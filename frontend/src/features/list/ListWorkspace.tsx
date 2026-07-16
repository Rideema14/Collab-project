'use client';

import { useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Filter,
  KanbanSquare,
  LayoutList,
  Search,
  Table2,
  Users,
  Waypoints,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveListId } from '@/store/slices/uiSlice';
import { setViewPrefs, DEFAULT_PREFS, type ViewKind } from '@/store/slices/tasksSlice';
import { selectListById, selectPrefsByList, selectSpaceById, selectTags } from '@/store/selectors';
import { useGetUsersQuery } from '@/store/api/backendApi';
import dynamic from 'next/dynamic';
import { softAccent } from '@/lib/domain/status-color';
import { cn } from '@/lib/design/cn';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import { Spinner } from '@/components/ui/Spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { TagChip } from '@/components/domain/TagChip';
import { PRIORITY_META } from '@/lib/domain/defaults';
import type { Priority } from '@/lib/domain/types';

const FILTER_PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];
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

const VIEW_TABS: { key: ViewKind; label: string; icon: typeof KanbanSquare }[] = [
  { key: 'board', label: 'Board', icon: KanbanSquare },
  { key: 'list', label: 'List', icon: LayoutList },
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'timeline', label: 'Timeline', icon: Waypoints },
  { key: 'workload', label: 'Workload', icon: Users },

];

export function ListWorkspace({ listId }: { listId: string }) {
  const dispatch = useAppDispatch();
  const list = useAppSelector(selectListById(listId));
  const space = useAppSelector(selectSpaceById(list?.spaceId ?? ''));
  const storedPrefs = useAppSelector(selectPrefsByList)[listId];
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...storedPrefs }), [storedPrefs]);
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
        <div className="flex items-center gap-1.5 text-xs text-text-subtle">
          <span
            className="h-3 w-3 rounded-[3px]"
            style={{ background: softAccent(space?.hue ?? 211).line }}
          />
          <span>{space?.name}</span>
          <span className="text-text-subtle/60">/</span>
          <span className="font-medium text-text-muted">{list.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="h-5 w-1.5 rounded-full"
            style={{ background: softAccent(space?.hue ?? 211).line }}
          />
          <h1 className="text-lg font-semibold text-text">{list.name}</h1>
        </div>

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

        <FiltersButton
          filterAssigneeIds={prefs.filterAssigneeIds}
          filterTagIds={prefs.filterTagIds}
          filterPriorities={prefs.filterPriorities}
          filterOverdueOnly={prefs.filterOverdueOnly}
          onChange={(changes) => set(changes)}
        />

        <div className="ml-auto flex items-center gap-1">
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
    default:
      return <BoardView listId={listId} />;
  }
}

function FiltersButton({
  filterAssigneeIds,
  filterTagIds,
  filterPriorities,
  filterOverdueOnly,
  onChange,
}: {
  filterAssigneeIds: number[];
  filterTagIds: string[];
  filterPriorities: Priority[];
  filterOverdueOnly: boolean;
  onChange: (changes: {
    filterAssigneeIds?: number[];
    filterTagIds?: string[];
    filterPriorities?: Priority[];
    filterOverdueOnly?: boolean;
  }) => void;
}) {
  const { data: users = [] } = useGetUsersQuery();
  const tags = useAppSelector(selectTags);
  const activeCount =
    filterAssigneeIds.length + filterTagIds.length + filterPriorities.length + (filterOverdueOnly ? 1 : 0);

  function toggleAssignee(id: number) {
    onChange({
      filterAssigneeIds: filterAssigneeIds.includes(id)
        ? filterAssigneeIds.filter((a) => a !== id)
        : [...filterAssigneeIds, id],
    });
  }

  function toggleTag(id: string) {
    onChange({
      filterTagIds: filterTagIds.includes(id) ? filterTagIds.filter((t) => t !== id) : [...filterTagIds, id],
    });
  }

  function togglePriority(p: Priority) {
    onChange({
      filterPriorities: filterPriorities.includes(p)
        ? filterPriorities.filter((x) => x !== p)
        : [...filterPriorities, p],
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
            activeCount > 0
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-text-muted hover:text-text'
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
          {activeCount > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-white">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-text">Filters</p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({ filterAssigneeIds: [], filterTagIds: [], filterPriorities: [], filterOverdueOnly: false })
              }
              className="text-xs text-text-subtle hover:text-text hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <label className="mb-3 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-text hover:bg-surface-muted">
          <input
            type="checkbox"
            checked={filterOverdueOnly}
            onChange={(e) => onChange({ filterOverdueOnly: e.target.checked })}
          />
          Overdue only
        </label>

        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">Priority</p>
        <div className="mb-3 space-y-1">
          {FILTER_PRIORITIES.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-text hover:bg-surface-muted">
              <input type="checkbox" checked={filterPriorities.includes(p)} onChange={() => togglePriority(p)} />
              {PRIORITY_META[p].label}
            </label>
          ))}
        </div>

        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">Assignee</p>
        <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
          {users.length === 0 && <p className="text-xs text-text-subtle">No members yet.</p>}
          {users.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-text hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={filterAssigneeIds.includes(u.id)}
                onChange={() => toggleAssignee(u.id)}
              />
              {u.name}
            </label>
          ))}
        </div>

        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">Tags</p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {tags.length === 0 && <p className="text-xs text-text-subtle">No tags yet.</p>}
          {tags.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-muted">
              <input type="checkbox" checked={filterTagIds.includes(t.id)} onChange={() => toggleTag(t.id)} />
              <TagChip tag={t} />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
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
