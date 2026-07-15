'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Status, Task } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { allTasks } from '@/lib/board';
import { formatDueDate } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import { STATUS_STYLES } from '@/components/board/status-styles';
import { useProject } from '../ProjectProvider';

type SortKey = 'title' | 'status' | 'due';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<Status, number> = { 'To Do': 0, 'In Progress': 1, Done: 2 };

export function ListView() {
  const { board, members, moveTask, openEditTask, openDeleteTask, openCreateTask } = useProject();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all'); // 'all' | 'unassigned' | userId
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'status', dir: 'asc' });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let tasks = allTasks(board);

    if (q) tasks = tasks.filter((t) => t.title.toLowerCase().includes(q));
    if (statusFilter !== 'all') tasks = tasks.filter((t) => t.status === statusFilter);
    if (assigneeFilter === 'unassigned') {
      tasks = tasks.filter((t) => !t.assignee);
    } else if (assigneeFilter !== 'all') {
      const id = Number(assigneeFilter);
      tasks = tasks.filter((t) => t.assignee?.id === id);
    }

    const sorted = [...tasks].sort((a, b) => {
      const factor = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'title') return factor * a.title.localeCompare(b.title);
      if (sort.key === 'status') return factor * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      // due: nulls always sort last regardless of direction
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return factor * a.dueDate.localeCompare(b.dueDate);
    });
    return sorted;
  }, [board, search, statusFilter, assigneeFilter, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  }

  const hasAnyTask = allTasks(board).length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title…"
          aria-label="Filter tasks by title"
          className="h-9 w-full flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none placeholder:text-text-subtle focus:border-primary sm:w-auto sm:min-w-48"
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as Status | 'all')}
          options={[{ value: 'all', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
        />
        <FilterSelect
          label="Assignee"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={[
            { value: 'all', label: 'All assignees' },
            { value: 'unassigned', label: 'Unassigned' },
            ...members.map((m) => ({ value: String(m.id), label: m.name })),
          ]}
        />
      </div>

      {!hasAnyTask ? (
        <EmptyState
          title="No tasks yet"
          message="Add a task to see it here."
          action={
            <button
              type="button"
              onClick={openCreateTask}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover"
            >
              Add a task
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
          <p className="text-sm font-medium text-text">No matching tasks</p>
          <p className="mt-1 text-sm text-text-muted">Try clearing a filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <SortableTh label="Task" active={sort.key === 'title'} dir={sort.dir} onClick={() => toggleSort('title')} />
                <SortableTh label="Status" active={sort.key === 'status'} dir={sort.dir} onClick={() => toggleSort('status')} className="w-40" />
                <th className="px-3 py-2 font-medium text-text-muted">Assignee</th>
                <SortableTh label="Due" active={sort.key === 'due'} dir={sort.dir} onClick={() => toggleSort('due')} className="w-32" />
                <th className="px-3 py-2 text-right font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onStatusChange={(to) => moveTask(task.id, to)}
                  onEdit={() => openEditTask(task)}
                  onDelete={() => openDeleteTask(task)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      className={clsx('px-3 py-2 font-medium text-text-muted', className)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-sm hover:text-text">
        {label}
        <span aria-hidden="true" className={clsx('text-[10px]', !active && 'opacity-30')}>
          {active && dir === 'desc' ? '▼' : '▲'}
        </span>
      </button>
    </th>
  );
}

function TaskRow({
  task,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: Task;
  onStatusChange: (to: Status) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-muted/50">
      <td className="px-3 py-2.5">
        <span className="font-medium text-text">{task.title}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={clsx('h-2 w-2 shrink-0 rounded-full', STATUS_STYLES[task.status].dot)} aria-hidden="true" />
          <select
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value as Status)}
            aria-label={`Status for ${task.title}`}
            className="rounded-md border border-transparent bg-transparent py-0.5 pl-1 pr-5 text-sm text-text outline-none hover:border-border focus:border-primary"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {task.assignee ? (
          <span className="flex items-center gap-1.5 text-text-muted">
            <Avatar name={task.assignee.name} />
            <span className="truncate">{task.assignee.name}</span>
          </span>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {task.dueDate ? (
          <span className={clsx(task.isOverdue ? 'font-medium text-danger' : 'text-text-muted')}>
            {formatDueDate(task.dueDate)}
          </span>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-surface hover:text-text"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
