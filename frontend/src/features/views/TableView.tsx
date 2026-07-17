'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { selectFieldsForList, selectFieldValues, selectTags } from '@/store/selectors';
import { formatDueDate } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { PRIORITY_META } from '@/lib/domain/defaults';
import type { TaskVM } from '@/lib/domain/types';
import type { CustomFieldDef, CustomFieldValue } from '@/store/slices/customFieldsSlice';
import { Avatar } from '@/components/domain/AvatarStack';
import { StatusChip } from '@/components/domain/StatusChip';
import { PriorityFlag } from '@/components/domain/PriorityFlag';
import { TagChip } from '@/components/domain/TagChip';
import { useListData, groupTasksBy } from '@/features/list/useListData';

const COLUMNS = ['Task', 'Status', 'Assignee', 'Due', 'Priority', 'Tags', 'Progress'] as const;

/** Spreadsheet view — every field, plus this list's custom fields, in one grid. Sectioned by the toolbar's Group selector. */
export function TableView({ listId }: { listId: string }) {
  const { allTasks, prefs, statusSet } = useListData(listId);
  const dispatch = useAppDispatch();
  const tags = useAppSelector(selectTags);
  const fields = useAppSelector(selectFieldsForList(listId));
  const colCount = COLUMNS.length + fields.length;

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
                <th key={f.id} className="px-3 py-2 font-medium">
                  {f.name}
                </th>
              ))}
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
    </tr>
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
