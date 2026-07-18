'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { selectFieldsForList, selectFieldValues, selectTags } from '@/store/selectors';
import { addField, removeField, type CustomFieldType } from '@/store/slices/customFieldsSlice';
import { formatDueDate } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { PRIORITY_META } from '@/lib/domain/defaults';
import type { TaskVM } from '@/lib/domain/types';
import type { CustomFieldDef, CustomFieldValue } from '@/store/slices/customFieldsSlice';
import { Avatar } from '@/components/domain/AvatarStack';
import { StatusChip } from '@/components/domain/StatusChip';
import { PriorityFlag } from '@/components/domain/PriorityFlag';
import { TagChip } from '@/components/domain/TagChip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { useListData, groupTasksBy } from '@/features/list/useListData';

const COLUMNS = ['Task', 'Status', 'Assignee', 'Due', 'Priority', 'Tags', 'Progress'] as const;

/** Column types offered when adding a custom column. */
const FIELD_TYPES: [CustomFieldType, string][] = [
  ['text', 'Text'],
  ['number', 'Number'],
  ['date', 'Date'],
  ['checkbox', 'Checkbox'],
  ['money', 'Money'],
  ['rating', 'Rating'],
];

/** Spreadsheet view — every field, plus this list's custom fields, in one grid. Sectioned by the toolbar's Group selector. */
export function TableView({ listId }: { listId: string }) {
  const { allTasks, prefs, statusSet } = useListData(listId);
  const dispatch = useAppDispatch();
  const tags = useAppSelector(selectTags);
  const fields = useAppSelector(selectFieldsForList(listId));
  // +1 for the trailing "add column" cell so group-header colSpan lines up.
  const colCount = COLUMNS.length + fields.length + 1;

  const sorted = allTasks
    .slice()
    .sort(
      (a, b) =>
        a.status.order - b.status.order ||
        PRIORITY_META[a.rich.priority].rank - PRIORITY_META[b.rich.priority].rank
    );

  const groups =
    prefs.groupBy === 'status'
      ? (statusSet?.statuses ?? [])
          .filter((s) => !s.archived)
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => ({ id: s.id, label: s.name, hue: s.hue, tasks: sorted.filter((t) => t.status.id === s.id) }))
          .filter((g) => g.tasks.length > 0)
      : groupTasksBy(sorted, prefs.groupBy).map((g) => ({ id: g.key, label: g.label, hue: g.hue, tasks: g.tasks }));

  return (
    <div className="px-4 py-4">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-text-subtle">
              {COLUMNS.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
              {fields.map((f) => (
                <th key={f.id} className="group px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => dispatch(removeField(f.id))}
                      aria-label={`Delete ${f.name} column`}
                      className="grid h-4 w-4 shrink-0 place-items-center rounded text-text-subtle opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </th>
              ))}
              <th className="w-10 px-2 py-2 text-right">
                <AddColumnButton listId={listId} />
              </th>
            </tr>
          </thead>
          <tbody className={cn('divide-y divide-border', prefs.density === 'compact' && '[&_td]:py-1.5')}>
            {groups.map((g) => (
              <GroupSection key={g.id} group={g} colCount={colCount} tags={tags} fields={fields} onOpen={(id) => dispatch(openTask(id))} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupSection({
  group,
  colCount,
  tags,
  fields,
  onOpen,
}: {
  group: { id: string; label: string; hue: number; tasks: TaskVM[] };
  colCount: number;
  tags: { id: string; label: string; hue: number }[];
  fields: CustomFieldDef[];
  onOpen: (id: number) => void;
}) {
  return (
    <>
      <tr className="bg-surface-muted/60">
        <td colSpan={colCount} className="px-3 py-1.5 text-xs font-semibold text-text-muted">
          {group.label} <span className="font-normal text-text-subtle">({group.tasks.length})</span>
        </td>
      </tr>
      {group.tasks.map((task) => (
        <TableRow key={task.id} task={task} allTags={tags} fields={fields} onOpen={() => onOpen(task.id)} />
      ))}
    </>
  );
}

function TableRow({
  task,
  allTags,
  fields,
  onOpen,
}: {
  task: TaskVM;
  allTags: { id: string; label: string; hue: number }[];
  fields: CustomFieldDef[];
  onOpen: () => void;
}) {
  const taskTags = allTags.filter((t) => task.rich.tagIds.includes(t.id));
  const subDone = task.rich.subtasks.filter((s) => s.done).length;
  const values = useAppSelector(selectFieldValues(task.id));
  return (
    <tr className="cursor-pointer bg-surface transition-colors hover:bg-surface-muted" onClick={onOpen}>
      <td className="px-3 py-2 font-medium text-text">{task.title}</td>
      <td className="px-3 py-2">
        <StatusChip status={task.status} />
      </td>
      <td className="px-3 py-2">{task.assignee ? <Avatar person={task.assignee} size={22} /> : <span className="text-text-subtle">—</span>}</td>
      <td className={cn('px-3 py-2 text-text-muted', task.isOverdue && 'font-medium text-danger')}>
        {task.dueDate ? formatDueDate(task.dueDate) : '—'}
      </td>
      <td className="px-3 py-2">
        <PriorityFlag priority={task.rich.priority} withLabel />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {taskTags.length ? taskTags.map((t) => <TagChip key={t.id} tag={t} />) : <span className="text-text-subtle">—</span>}
        </div>
      </td>
      <td className="px-3 py-2 text-text-muted">
        {task.rich.subtasks.length ? `${subDone}/${task.rich.subtasks.length}` : '—'}
      </td>
      {fields.map((f) => (
        <td key={f.id} className="px-3 py-2 text-text-muted">
          {renderFieldValue(f, values[f.id] ?? null)}
        </td>
      ))}
      {/* spacer under the "add column" header */}
      <td className="px-2 py-2" aria-hidden />
    </tr>
  );
}

/** Header control: pops a tiny form to add a new custom column (name + type). */
function AddColumnButton({ listId }: { listId: string }) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    dispatch(addField({ listId, name: clean, type }));
    setName('');
    setType('text');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add column"
          className="grid h-6 w-6 place-items-center rounded-md border border-border text-text-subtle transition-colors hover:bg-surface-muted hover:text-text"
        >
          <Plus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-text">New column</p>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Column name…"
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            aria-label="Column type"
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text"
          >
            {FIELD_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-8 rounded-md bg-primary text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Add column
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function renderFieldValue(field: CustomFieldDef, value: CustomFieldValue) {
  if (value === null || value === '' || value === undefined) return <span className="text-text-subtle">—</span>;
  switch (field.type) {
    case 'checkbox':
      return value ? '✓' : '—';
    case 'money':
      return typeof value === 'number' ? `$${value.toLocaleString()}` : String(value);
    case 'rating':
      return typeof value === 'number' ? '★'.repeat(value) : String(value);
    case 'dropdown':
      return field.options.find((o) => o.id === value)?.label ?? String(value);
    default:
      return String(value);
  }
}
