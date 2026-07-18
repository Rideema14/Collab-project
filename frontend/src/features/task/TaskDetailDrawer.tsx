'use client';

import { useMemo, useRef, useState } from 'react';
import { Play, Plus, Square, Trash2, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeTask } from '@/store/slices/uiSlice';
import {
  selectFieldsForList,
  selectFieldValues,
  selectOpenTaskId,
  selectRunningTimer,
  selectSessionUser,
  selectSprintsForList,
  selectTags,
  selectTimeEntries,
} from '@/store/selectors';
import {
  addAttachment,
  addChecklist,
  addChecklistItem,
  addDependency,
  addSubtask,
  logTime,
  removeAttachment,
  removeDependency,
  removeSubtask,
  setDescription,
  setPriority,
  setSprint,
  setSubtaskAssignee,
  setSubtaskDueDate,
  setSubtaskPriority,
  setSubtaskStatus,
  setTags,
  toggleChecklistItem,
  toggleSubtask,
  toggleWatcher,
} from '@/store/slices/tasksSlice';
import { addSprint } from '@/store/slices/sprintsSlice';
import { addComment } from '@/store/slices/commentsSlice';
import { addField, removeField, setValue, type CustomFieldType } from '@/store/slices/customFieldsSlice';
import { startTimer, clearTimer, addEntry, removeEntry } from '@/store/slices/timeSlice';
import { broadcast } from '@/store/middleware/socketMiddleware';
import { useGetUsersQuery } from '@/store/api/backendApi';
import { relativeTime, formatDuration } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { PRIORITY_META } from '@/lib/domain/defaults';
import { normalizeSubtask, type DependencyType, type Priority, type SubtaskStatus, type TaskVM } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Checkbox } from '@/components/ui/Checkbox';
import { Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/domain/AvatarStack';
import { StatusChip } from '@/components/domain/StatusChip';
import { TagChip } from '@/components/domain/TagChip';
import { useTaskVM, useListData } from '@/features/list/useListData';
import { useListActions } from '@/features/list/useListActions';
import { useTemplateActions } from '@/features/templates/useTemplateActions';
import { useToast } from '@/lib/toast-context';

const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];

export function TaskDetailDrawer({ listId }: { listId: string }) {
  const dispatch = useAppDispatch();
  const openId = useAppSelector(selectOpenTaskId);
  const task = useTaskVM(listId, openId);

  return (
    <Drawer
      open={openId != null && task != null}
      onOpenChange={(o) => !o && dispatch(closeTask())}
      title={
        task ? (
          <div className="flex items-center gap-2">
            <StatusChip status={task.status} />
            <span className="truncate text-sm font-semibold text-text">{task.title}</span>
          </div>
        ) : (
          'Task'
        )
      }
    >
      {task && <Body key={task.id} listId={listId} taskId={task.id} />}
    </Drawer>
  );
}

function Body({ listId, taskId }: { listId: string; taskId: number }) {
  const dispatch = useAppDispatch();
  const task = useTaskVM(listId, taskId)!;
  const { updateTask, deleteTask } = useListActions(listId);
  const { data: users = [] } = useGetUsersQuery();
  const { saveTaskAsTemplate } = useTemplateActions();
  const { notify } = useToast();

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 p-4">
      <div className="mb-3 flex items-start gap-2">
        <input
          defaultValue={task.title}
          onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && updateTask(taskId, { title: e.target.value.trim() })}
          className="w-full flex-1 bg-transparent text-lg font-semibold text-text outline-none"
        />
        <button
          type="button"
          onClick={() => {
            saveTaskAsTemplate(taskId, task.title, `${task.title} template`);
            notify('success', 'Saved as a task template');
          }}
          className="shrink-0 whitespace-nowrap rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          Save as template
        </button>
      </div>

      {/* Meta grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 text-sm">
        <Meta label="Assignee">
          <select
            value={task.assignee?.id ?? ''}
            onChange={(e) => updateTask(taskId, { assigneeId: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded border border-border bg-surface px-1.5 py-1 text-sm text-text"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Meta>
        <Meta label="Due date">
          <input
            type="date"
            value={task.dueDate ?? ''}
            onChange={(e) => updateTask(taskId, { dueDate: e.target.value || null })}
            className="w-full rounded border border-border bg-surface px-1.5 py-1 text-sm text-text"
          />
          {task.isOverdue && <span className="text-xs font-medium text-danger">Overdue</span>}
        </Meta>
        <Meta label="Priority">
          <select
            value={task.rich.priority}
            onChange={(e) => dispatch(setPriority({ taskId, priority: e.target.value as Priority }))}
            className="w-full rounded border border-border bg-surface px-1.5 py-1 text-sm text-text"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </Meta>
        <Meta label="Sprint">
          <SprintPicker listId={listId} taskId={taskId} sprintId={task.rich.sprintId} />
        </Meta>
        <Meta label="Watchers">
          <div className="flex flex-wrap items-center gap-1">
            {task.rich.watcherIds.map((id) => {
              const u = users.find((x) => x.id === id);
              return u ? <Avatar key={id} person={u} size={22} /> : null;
            })}
            <select
              value=""
              onChange={(e) => e.target.value && dispatch(toggleWatcher({ taskId, userId: Number(e.target.value) }))}
              className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-text-muted"
              aria-label="Toggle watcher"
            >
              <option value="">＋</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {task.rich.watcherIds.includes(u.id) ? '− ' : '+ '}
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </Meta>
      </div>

      <TagEditor taskId={taskId} current={task.rich.tagIds} />

      <CustomFields taskId={taskId} listId={listId} />

      <Tabs defaultValue="subtasks" className="mt-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="description">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="subtasks" className="mt-3">
          <Subtasks taskId={taskId} />
        </TabsContent>
        <TabsContent value="checklists" className="mt-3">
          <Checklists taskId={taskId} />
        </TabsContent>
        <TabsContent value="time" className="mt-3">
          <TimePanel taskId={taskId} />
        </TabsContent>
        <TabsContent value="links" className="mt-3">
          <Dependencies taskId={taskId} listId={listId} />
        </TabsContent>
        <TabsContent value="files" className="mt-3">
          <Attachments taskId={taskId} />
        </TabsContent>
        <TabsContent value="comments" className="mt-3">
          <Comments taskId={taskId} />
        </TabsContent>
        <TabsContent value="description" className="mt-3">
          <Textarea
            rows={6}
            defaultValue={task.rich.description}
            placeholder="Add notes, context, acceptance criteria…"
            onBlur={(e) => dispatch(setDescription({ taskId, description: e.target.value }))}
          />
        </TabsContent>
      </Tabs>
      </div>

      <DeleteFooter
        task={task}
        onDelete={async () => {
          await deleteTask(taskId, task.title);
          dispatch(closeTask());
        }}
      />
    </div>
  );
}

/** Sticky drawer footer: last-updated stamp + a two-step delete confirm. */
function DeleteFooter({ task, onDelete }: { task: TaskVM; onDelete: () => void | Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-surface px-4 py-3">
      <span className="text-xs text-text-subtle">Updated {relativeTime(task.updatedAt)}</span>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Delete permanently?</span>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onDelete();
            }}
          >
            Delete
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-danger transition-colors hover:bg-danger-soft"
        >
          <Trash2 className="h-4 w-4" /> Delete task
        </button>
      )}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-subtle">{label}</p>
      {children}
    </div>
  );
}

function TagEditor({ taskId, current }: { taskId: number; current: string[] }) {
  const dispatch = useAppDispatch();
  const allTags = useAppSelector(selectTags);
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-subtle">Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((tag) => {
          const on = current.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() =>
                dispatch(setTags({ taskId, tagIds: on ? current.filter((t) => t !== tag.id) : [...current, tag.id] }))
              }
              className={on ? 'opacity-100' : 'opacity-40 hover:opacity-80'}
            >
              <TagChip tag={tag} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SprintPicker({ listId, taskId, sprintId }: { listId: string; taskId: number; sprintId: string | null }) {
  const dispatch = useAppDispatch();
  const sprints = useAppSelector(selectSprintsForList(listId));
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  if (creating) {
    return (
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const action = dispatch(addSprint({ listId, name }));
          dispatch(setSprint({ taskId, sprintId: action.payload.id }));
          setName('');
          setCreating(false);
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => !name.trim() && setCreating(false)}
          placeholder="Sprint name…"
          className="w-full rounded border border-border bg-surface px-1.5 py-1 text-sm text-text outline-none focus:border-primary"
        />
      </form>
    );
  }

  return (
    <select
      value={sprintId ?? ''}
      onChange={(e) => {
        if (e.target.value === '__new__') setCreating(true);
        else dispatch(setSprint({ taskId, sprintId: e.target.value || null }));
      }}
      className="w-full rounded border border-border bg-surface px-1.5 py-1 text-sm text-text"
    >
      <option value="">No sprint</option>
      {sprints.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
      <option value="__new__">+ New sprint…</option>
    </select>
  );
}

const SUBTASK_STATUSES: SubtaskStatus[] = ['todo', 'in_progress', 'done'];
const SUBTASK_STATUS_LABEL: Record<SubtaskStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

function Subtasks({ taskId }: { taskId: number }) {
  const dispatch = useAppDispatch();
  const task = useAppSelector((s) => s.tasks.richById[taskId]);
  const { data: users = [] } = useGetUsersQuery();
  const [title, setTitle] = useState('');
  const subs = (task?.subtasks ?? []).map(normalizeSubtask);
  const done = subs.filter((s) => s.status === 'done').length;

  return (
    <div className="space-y-2">
      {subs.length > 0 && (
        <p className="text-xs text-text-subtle">
          {done}/{subs.length} complete
        </p>
      )}
      <div className="space-y-1.5">
        {subs.map((sub) => (
          <div key={sub.id} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border p-1.5">
            <Checkbox
              checked={sub.status === 'done'}
              onCheckedChange={() => dispatch(toggleSubtask({ taskId, subtaskId: sub.id }))}
            />
            <span className={cn('min-w-[6rem] flex-1 text-sm', sub.status === 'done' ? 'text-text-subtle line-through' : 'text-text')}>
              {sub.title}
            </span>
            <select
              value={sub.status}
              onChange={(e) => dispatch(setSubtaskStatus({ taskId, subtaskId: sub.id, status: e.target.value as SubtaskStatus }))}
              aria-label={`Status for ${sub.title}`}
              className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-text-muted"
            >
              {SUBTASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SUBTASK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={sub.priority}
              onChange={(e) => dispatch(setSubtaskPriority({ taskId, subtaskId: sub.id, priority: e.target.value as Priority }))}
              aria-label={`Priority for ${sub.title}`}
              className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-text-muted"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={sub.dueDate ?? ''}
              onChange={(e) => dispatch(setSubtaskDueDate({ taskId, subtaskId: sub.id, dueDate: e.target.value || null }))}
              aria-label={`Due date for ${sub.title}`}
              className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-text-muted"
            />
            <select
              value={sub.assigneeId ?? ''}
              onChange={(e) =>
                dispatch(setSubtaskAssignee({ taskId, subtaskId: sub.id, assigneeId: e.target.value ? Number(e.target.value) : null }))
              }
              aria-label={`Assignee for ${sub.title}`}
              className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-text-muted"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => dispatch(removeSubtask({ taskId, subtaskId: sub.id }))}
              aria-label={`Remove ${sub.title}`}
              className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          dispatch(addSubtask({ taskId, title }));
          setTitle('');
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a subtask…"
          className="h-8 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-md border border-border px-2 text-text-muted hover:bg-surface-muted" aria-label="Add subtask">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function Checklists({ taskId }: { taskId: number }) {
  const dispatch = useAppDispatch();
  const task = useAppSelector((s) => s.tasks.richById[taskId]);
  const lists = task?.checklists ?? [];
  return (
    <div className="space-y-3">
      {lists.map((cl) => {
        const done = cl.items.filter((i) => i.done).length;
        return (
          <div key={cl.id} className="rounded-lg border border-border p-2">
            <div className="mb-1 flex items-center justify-between text-sm font-medium text-text">
              <span>{cl.name}</span>
              <span className="text-xs text-text-subtle">
                {done}/{cl.items.length}
              </span>
            </div>
            {cl.items.map((item) => (
              <label key={item.id} className="flex items-center gap-2 py-0.5 text-sm">
                <Checkbox
                  checked={item.done}
                  onCheckedChange={() => dispatch(toggleChecklistItem({ taskId, checklistId: cl.id, itemId: item.id }))}
                />
                <span className={item.done ? 'text-text-subtle line-through' : 'text-text'}>{item.text}</span>
              </label>
            ))}
            <AddInline placeholder="Add item…" onAdd={(text) => dispatch(addChecklistItem({ taskId, checklistId: cl.id, text }))} />
          </div>
        );
      })}
      <AddInline placeholder="New checklist…" onAdd={(name) => dispatch(addChecklist({ taskId, name }))} accent />
    </div>
  );
}

function AddInline({ placeholder, onAdd, accent }: { placeholder: string; onAdd: (v: string) => void; accent?: boolean }) {
  const [v, setV] = useState('');
  return (
    <form
      className="mt-1 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        onAdd(v);
        setV('');
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className={`h-7 flex-1 rounded-md border bg-surface px-2 text-sm text-text outline-none focus:border-primary ${accent ? 'border-dashed border-border-strong' : 'border-border'}`}
      />
    </form>
  );
}

function Comments({ taskId }: { taskId: number }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectSessionUser);
  const comments = useAppSelector((s) => s.comments.byTaskId[taskId] ?? []);
  const typing = useAppSelector((s) => s.presence.typing[taskId] ?? []);
  const selfId = useAppSelector((s) => s.presence.selfClientId);
  const { data: users = [] } = useGetUsersQuery();
  const [body, setBody] = useState('');

  const roster = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const someoneElseTyping = typing.some((c) => c !== selfId);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {comments.map((c) => {
          const author = c.authorId === user?.id ? user : roster.get(c.authorId);
          return (
            <div key={c.id} className="flex gap-2">
              {author && <Avatar person={author} size={26} />}
              <div className="min-w-0 flex-1 rounded-lg bg-surface-muted/60 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-text">{author?.name ?? 'Someone'}</span>
                  <span className="text-xs text-text-subtle">{relativeTime(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-text-muted">{c.body}</p>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && <p className="text-sm text-text-subtle">No comments yet.</p>}
        {someoneElseTyping && <p className="text-xs italic text-text-subtle">Someone is typing…</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim() || !user) return;
          dispatch(addComment({ taskId, authorId: user.id, body, createdAt: new Date().toISOString() }));
          dispatch(broadcast({ type: 'typing', origin: selfId, taskId, clientId: selfId, typing: false }));
          setBody('');
        }}
      >
        <input
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            dispatch(broadcast({ type: 'typing', origin: selfId, taskId, clientId: selfId, typing: e.target.value.length > 0 }));
          }}
          placeholder={user ? 'Write a comment…' : 'Sign in to comment'}
          disabled={!user}
          className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!body.trim()}
          className="rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-55"
        >
          Send
        </button>
      </form>
    </div>
  );
}

/* ─────────────────── Custom fields ─────────────────── */

const FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'money', 'date', 'checkbox', 'dropdown', 'rating'];

function CustomFields({ taskId, listId }: { taskId: number; listId: string }) {
  const dispatch = useAppDispatch();
  const defs = useAppSelector(selectFieldsForList(listId));
  const values = useAppSelector(selectFieldValues(taskId));
  const [adding, setAdding] = useState(false);
  return (
    <div className="mt-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-subtle">Custom fields</p>
      <div className="space-y-2 rounded-lg border border-border bg-surface-muted/40 p-3">
        {defs.length === 0 && !adding && <p className="text-sm text-text-subtle">No custom fields for this list.</p>}
        {defs.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs text-text-muted">{f.name}</span>
            <FieldInput
              field={f}
              value={values[f.id] ?? null}
              onChange={(v) => dispatch(setValue({ taskId, fieldId: f.id, value: v }))}
            />
            <button type="button" aria-label="Remove field" onClick={() => dispatch(removeField(f.id))} className="text-text-subtle hover:text-danger">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {adding ? (
          <AddFieldForm listId={listId} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: { type: CustomFieldType; options: { id: string; label: string }[] };
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
}) {
  const cls = 'h-8 flex-1 rounded border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary';
  switch (field.type) {
    case 'number':
    case 'money':
      return <input type="number" className={cls} value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'date':
      return <input type="date" className={cls} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'checkbox':
      return <div className="flex-1"><Checkbox checked={Boolean(value)} onCheckedChange={(c) => onChange(Boolean(c))} /></div>;
    case 'dropdown':
      return (
        <select className={cls} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      );
    case 'rating':
      return (
        <div className="flex flex-1 gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onChange(n === value ? null : n)} className={cn('text-lg leading-none', typeof value === 'number' && value >= n ? 'text-warning' : 'text-text-subtle')}>★</button>
          ))}
        </div>
      );
    default:
      return <input className={cls} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function AddFieldForm({ listId, onDone }: { listId: string; onDone: () => void }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        dispatch(addField({ listId, name, type }));
        onDone();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Field name" className="h-8 w-32 rounded border border-border bg-surface px-2 text-sm text-text outline-none" />
      <select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)} className="h-8 rounded border border-border bg-surface px-1 text-sm text-text">
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-fg">Add</button>
      <button type="button" onClick={onDone} className="text-xs text-text-muted">Cancel</button>
    </form>
  );
}

/* ─────────────────── Time tracking ─────────────────── */

function TimePanel({ taskId }: { taskId: number }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectSessionUser);
  const running = useAppSelector(selectRunningTimer);
  const entries = useAppSelector(selectTimeEntries).filter((e) => e.taskId === taskId);
  const total = entries.reduce((s, e) => s + e.minutes, 0);
  const isRunningThis = running?.taskId === taskId;
  const [manual, setManual] = useState('');

  function stop() {
    if (!running) return;
    const mins = Math.max(1, Math.round((Date.now() - running.startedAt) / 60000));
    dispatch(addEntry({ taskId, userId: user?.id ?? null, minutes: mins }));
    dispatch(logTime({ taskId, minutes: mins }));
    dispatch(clearTimer());
  }
  function addManual() {
    const mins = parseInt(manual, 10);
    if (!mins || mins <= 0) return;
    dispatch(addEntry({ taskId, userId: user?.id ?? null, minutes: mins }));
    dispatch(logTime({ taskId, minutes: mins }));
    setManual('');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-text">Total: {formatDuration(total)}</span>
        {isRunningThis ? (
          <button type="button" onClick={stop} className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-primary-fg">
            <Square className="h-3.5 w-3.5" /> Stop timer
          </button>
        ) : (
          <button type="button" onClick={() => dispatch(startTimer(taskId))} disabled={Boolean(running)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-50">
            <Play className="h-3.5 w-3.5" /> Start timer
          </button>
        )}
      </div>
      {running && !isRunningThis && <p className="text-xs text-text-subtle">A timer is running on another task.</p>}
      <div className="flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Minutes…" type="number" className="h-8 w-28 rounded border border-border bg-surface px-2 text-sm text-text outline-none" />
        <button type="button" onClick={addManual} className="rounded-md border border-border px-2 text-sm text-text-muted hover:bg-surface-muted">Log time</button>
      </div>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-sm">
            <span className="text-text">{formatDuration(e.minutes)}</span>
            <span className="text-xs text-text-subtle">{relativeTime(e.at)}</span>
            <button type="button" aria-label="Remove entry" onClick={() => { dispatch(removeEntry(e.id)); dispatch(logTime({ taskId, minutes: -e.minutes })); }} className="ml-auto text-text-subtle hover:text-danger">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── Dependencies ─────────────────── */

const DEP_LABEL: Record<DependencyType, string> = { blocks: 'Blocks', blocked_by: 'Blocked by', relates_to: 'Relates to' };

function Dependencies({ taskId, listId }: { taskId: number; listId: string }) {
  const dispatch = useAppDispatch();
  const { allTasks } = useListData(listId);
  const rich = useAppSelector((s) => s.tasks.richById[taskId]);
  const deps = rich?.dependencies ?? [];
  const [type, setType] = useState<DependencyType>('blocks');
  const [other, setOther] = useState('');
  const byId = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);

  return (
    <div className="space-y-2">
      {deps.map((d) => {
        const t = byId.get(d.taskId);
        return (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-xs text-text-muted">{DEP_LABEL[d.type]}</span>
            <span className="min-w-0 truncate text-text">{t?.title ?? `Task #${d.taskId}`}</span>
            <button type="button" aria-label="Remove link" onClick={() => dispatch(removeDependency({ taskId, dependencyId: d.id }))} className="ml-auto shrink-0 text-text-subtle hover:text-danger">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      {deps.length === 0 && <p className="text-sm text-text-subtle">No linked tasks.</p>}
      <form
        className="flex flex-wrap items-center gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          const otherId = Number(other);
          if (!otherId || otherId === taskId) return;
          dispatch(addDependency({ taskId, otherTaskId: otherId, type }));
          setOther('');
        }}
      >
        <select value={type} onChange={(e) => setType(e.target.value as DependencyType)} className="h-8 rounded border border-border bg-surface px-1 text-sm text-text">
          <option value="blocks">Blocks</option>
          <option value="blocked_by">Blocked by</option>
          <option value="relates_to">Relates to</option>
        </select>
        <select value={other} onChange={(e) => setOther(e.target.value)} className="h-8 min-w-0 flex-1 rounded border border-border bg-surface px-1 text-sm text-text">
          <option value="">Pick a task…</option>
          {allTasks.filter((t) => t.id !== taskId).map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-fg">Link</button>
      </form>
    </div>
  );
}

/* ─────────────────── Attachments (client-only data URLs) ─────────────────── */

/**
 * Files live in localStorage as base64 data URLs, which costs ~33% more than the
 * raw bytes and shares one ~5MB origin quota with the ENTIRE persisted workspace.
 * Without a cap, one phone photo overflows that quota — and redux-persist then
 * fails every subsequent write, silently losing tasks/statuses/chat rather than
 * just the file. So oversized files are rejected up front, with an explanation.
 */
const MAX_ATTACHMENT_BYTES = 512 * 1024;

function Attachments({ taskId }: { taskId: number }) {
  const dispatch = useAppDispatch();
  const { notify } = useToast();
  const rich = useAppSelector((s) => s.tasks.richById[taskId]);
  const files = rich?.attachments ?? [];
  const inputRef = useRef<HTMLInputElement>(null);

  function onFiles(list: FileList | null) {
    if (!list) return;
    Array.from(list).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        notify('error', `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — files must be under 512KB while attachments are stored in your browser.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => dispatch(addAttachment({ taskId, name: file.name, url: String(reader.result), size: file.size, mime: file.type }));
      reader.onerror = () => notify('error', `Couldn't read ${file.name}.`);
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="space-y-2">
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
          <a href={f.url} download={f.name} className="min-w-0 flex-1 truncate text-primary hover:underline">{f.name}</a>
          <span className="shrink-0 text-xs text-text-subtle">{(f.size / 1024).toFixed(0)} KB</span>
          <button type="button" aria-label="Remove file" onClick={() => dispatch(removeAttachment({ taskId, attachmentId: f.id }))} className="shrink-0 text-text-subtle hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {files.length === 0 && <p className="text-sm text-text-subtle">No files attached.</p>}
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-3 py-2 text-sm text-text-muted hover:bg-surface-muted">
        <Plus className="h-4 w-4" /> Attach files
      </button>
      <p className="text-[11px] text-text-subtle">Files are stored locally in your browser — up to 512KB each.</p>
    </div>
  );
}