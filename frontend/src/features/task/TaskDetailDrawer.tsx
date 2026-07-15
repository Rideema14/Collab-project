'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeTask } from '@/store/slices/uiSlice';
import { selectOpenTaskId, selectSessionUser, selectTags } from '@/store/selectors';
import {
  addChecklist,
  addChecklistItem,
  addSubtask,
  setDescription,
  setPriority,
  setTags,
  toggleChecklistItem,
  toggleSubtask,
  toggleWatcher,
} from '@/store/slices/tasksSlice';
import { addComment } from '@/store/slices/commentsSlice';
import { broadcast } from '@/store/middleware/socketMiddleware';
import { useGetUsersQuery } from '@/store/api/backendApi';
import { relativeTime } from '@/lib/format';
import { PRIORITY_META } from '@/lib/domain/defaults';
import type { Priority, TaskVM } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Checkbox } from '@/components/ui/Checkbox';
import { Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/domain/AvatarStack';
import { StatusChip } from '@/components/domain/StatusChip';
import { TagChip } from '@/components/domain/TagChip';
import { useTaskVM } from '@/features/list/useListData';
import { useListActions } from '@/features/list/useListActions';

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

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 p-4">
      <input
        defaultValue={task.title}
        onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && updateTask(taskId, { title: e.target.value.trim() })}
        className="mb-3 w-full bg-transparent text-lg font-semibold text-text outline-none"
      />

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

      <Tabs defaultValue="subtasks" className="mt-4">
        <TabsList>
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="description">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="subtasks" className="mt-3">
          <Subtasks taskId={taskId} />
        </TabsContent>
        <TabsContent value="checklists" className="mt-3">
          <Checklists taskId={taskId} />
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
    <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-surface/90 px-4 py-3 backdrop-blur">
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

function Subtasks({ taskId }: { taskId: number }) {
  const dispatch = useAppDispatch();
  const task = useAppSelector((s) => s.tasks.richById[taskId]);
  const [title, setTitle] = useState('');
  const subs = task?.subtasks ?? [];
  return (
    <div className="space-y-1.5">
      {subs.map((sub) => (
        <label key={sub.id} className="flex items-center gap-2 text-sm">
          <Checkbox checked={sub.done} onCheckedChange={() => dispatch(toggleSubtask({ taskId, subtaskId: sub.id }))} />
          <span className={sub.done ? 'text-text-subtle line-through' : 'text-text'}>{sub.title}</span>
        </label>
      ))}
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
