'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, GripVertical, MoreHorizontal, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { setOrder, addSubtask } from '@/store/slices/tasksSlice';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import type { TaskVM } from '@/lib/domain/types';
import { TaskCardContent } from '@/features/task/TaskCardContent';
import { useListData, type StatusColumn } from '@/features/list/useListData';
import { useListActions } from '@/features/list/useListActions';
import { useStatusActions } from '@/features/statuses/useStatusActions';
import { StatusManager } from '@/features/statuses/StatusManager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { IconButton } from '@/components/ui/Misc';
import { QuickAddTask } from '@/features/list/QuickAddTask';

/** Prefix distinguishing a column-header drag (reordering statuses) from a task-card drag, in the one shared DndContext. */
const COL_PREFIX = 'colhead:';

export function BoardView({ listId }: { listId: string }) {
  const { columns } = useListData(listId);
  const { moveToStatus, deleteTask, updateTask } = useListActions(listId);
  const { reorder: reorderStatus } = useStatusActions(listId);
  const dispatch = useAppDispatch();
  const commentsByTask = useAppSelector((s) => s.comments.byTaskId);
  const [activeTask, setActiveTask] = useState<TaskVM | null>(null);

  // Stable callbacks so memoized columns/cards don't re-render on every board render
  // (notably during a drag, when dnd-kit re-renders the DndContext continuously).
  const handleOpen = useCallback((id: number) => dispatch(openTask(id)), [dispatch]);
  const handleDelete = useCallback((id: number, title: string) => void deleteTask(id, title), [deleteTask]);
  const handleEditTitle = useCallback((id: number, title: string) => void updateTask(id, { title }), [updateTask]);
  const handleAddSubtask = useCallback(
    (id: number, title: string) => dispatch(addSubtask({ taskId: id, title })),
    [dispatch]
  );

  const byId = useMemo(() => {
    const map = new Map<number, { task: TaskVM; statusId: string }>();
    columns.forEach((col) => col.tasks.forEach((t) => map.set(t.id, { task: t, statusId: col.status.id })));
    return map;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith(COL_PREFIX)) {
      setActiveTask(null);
      return;
    }
    setActiveTask(byId.get(Number(id))?.task ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith(COL_PREFIX)) {
      if (!overId.startsWith(COL_PREFIX)) return;
      const activeStatusId = activeId.slice(COL_PREFIX.length);
      const overStatusId = overId.slice(COL_PREFIX.length);
      if (activeStatusId === overStatusId) return;
      const toIndex = columns.findIndex((c) => c.status.id === overStatusId);
      if (toIndex !== -1) reorderStatus(activeStatusId, toIndex);
      return;
    }

    const taskId = Number(active.id);
    const targetStatusId = overId.startsWith('col:') ? overId.slice(4) : byId.get(Number(overId))?.statusId;
    if (!targetStatusId) return;
    const targetStatus = columns.find((c) => c.status.id === targetStatusId)?.status;
    if (!targetStatus) return;

    const targetCol = columns.find((c) => c.status.id === targetStatusId);
    const orderedIds = targetCol ? targetCol.tasks.map((t) => t.id).filter((id) => id !== taskId) : [];
    const overIndex = overId.startsWith('col:') ? orderedIds.length : orderedIds.indexOf(Number(overId));
    const insertAt = overIndex < 0 ? orderedIds.length : overIndex;
    orderedIds.splice(insertAt, 0, taskId);

    orderedIds.forEach((id, i) => dispatch(setOrder({ taskId: id, order: i })));
    void moveToStatus(taskId, targetStatus, insertAt);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      autoScroll={{ threshold: { x: 0.15, y: 0.2 } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto overflow-y-hidden px-5 py-5">
        <SortableContext
          items={columns.map((c) => `${COL_PREFIX}${c.status.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((col) => (
            <BoardColumn
              key={col.status.id}
              column={col}
              listId={listId}
              commentsByTask={commentsByTask}
              onOpen={handleOpen}
              onDelete={handleDelete}
              onEditTitle={handleEditTitle}
              onAddSubtask={handleAddSubtask}
            />
          ))}
        </SortableContext>
        <AddStatusButton listId={listId} />
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
        {activeTask && (
          <div className="w-[264px] cursor-grabbing">
            <TaskCardContent task={activeTask} overlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

const BoardColumn = memo(function BoardColumn({
  column,
  listId,
  commentsByTask,
  onOpen,
  onDelete,
  onEditTitle,
  onAddSubtask,
}: {
  column: StatusColumn;
  listId: string;
  commentsByTask: Record<number, unknown[]>;
  onOpen: (id: number) => void;
  onDelete: (id: number, title: string) => void;
  onEditTitle: (id: number, title: string) => void;
  onAddSubtask: (id: number, title: string) => void;
}) {
  const { theme } = useTheme();
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.status.id}` });
  const {
    attributes: colAttributes,
    listeners: colListeners,
    setNodeRef: setColumnNodeRef,
    transform: colTransform,
    transition: colTransition,
    isDragging: colIsDragging,
  } = useSortable({ id: `${COL_PREFIX}${column.status.id}` });
  const c = statusColors(column.status.hue, theme);
  const [adding, setAdding] = useState(false);
  const count = column.tasks.length;

  return (
    <section
      ref={setColumnNodeRef}
      style={{
        transform: CSS.Translate.toString(colTransform),
        transition: colTransition,
        background: theme === 'light' ? '#e5e8ef' : 'var(--color-surface-muted)',
      }}
      className={cn(
        'flex w-[288px] shrink-0 animate-scale-in flex-col rounded-2xl border border-glass-border',
        colIsDragging && 'opacity-50'
      )}
    >
      <header
        {...colAttributes}
        {...colListeners}
        className="flex cursor-grab items-center gap-2 rounded-t-2xl px-4 pt-4 pb-3 touch-none active:cursor-grabbing"
        style={{ background: `linear-gradient(180deg, ${c.soft}, transparent)` }}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-subtle/50" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.solid }} />
        <h3 className="text-sm font-semibold text-text">{column.status.name}</h3>
        <span
          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: c.soft, color: c.onSoft }}
        >
          {count} {count === 1 ? 'task' : 'tasks'}
        </span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Add task to ${column.status.name}`}
          className="ml-auto grid h-6 w-6 place-items-center rounded-md text-text-subtle transition-colors hover:bg-glass-border hover:text-text"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2.5 overflow-y-auto px-3 pb-3 pt-3 transition-colors',
          isOver && 'rounded-b-2xl bg-primary-soft/20 ring-1 ring-inset ring-[color:var(--color-primary)]/30'
        )}
      >
        {adding && (
          <QuickAddTask
            listId={listId}
            statusId={column.status.id}
            open={adding}
            onOpenChange={setAdding}
            hideTrigger
          />
        )}
        <SortableContext items={column.tasks.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {column.tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                commentCount={commentsByTask[task.id]?.length ?? 0}
                onOpen={onOpen}
                onDelete={onDelete}
                onEditTitle={onEditTitle}
                onAddSubtask={onAddSubtask}
              />
            ))}
          </div>
        </SortableContext>
        {count === 0 && !adding && (
          <p className="px-1 py-6 text-center text-xs text-text-subtle">No tasks yet</p>
        )}
        <QuickAddTask listId={listId} statusId={column.status.id} />
      </div>
    </section>
  );
});

const SortableCard = memo(function SortableCard({
  task,
  commentCount,
  onOpen,
  onDelete,
  onEditTitle,
  onAddSubtask,
}: {
  task: TaskVM;
  commentCount: number;
  onOpen: (id: number) => void;
  onDelete: (id: number, title: string) => void;
  onEditTitle: (id: number, title: string) => void;
  onAddSubtask: (id: number, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
    data: { statusId: task.status.id },
  });
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [addingSubtask, setAddingSubtask] = useState(false);

  function startEdit() {
    setTitleDraft(task.title);
    setEditing(true);
  }
  function commitEdit() {
    setEditing(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) onEditTitle(task.id, trimmed);
  }
  function cancelEdit() {
    setEditing(false);
    setTitleDraft(task.title);
  }

  return (
    <div className="animate-fade-in">
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn('group/sc relative cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
        {...attributes}
        {...(editing ? {} : listeners)}
        role="button"
        tabIndex={0}
        onClick={() => !editing && onOpen(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !editing) onOpen(task.id);
        }}
      >
        <TaskCardContent
          task={task}
          commentCount={commentCount}
          editing={editing}
          titleDraft={titleDraft}
          onTitleDraftChange={setTitleDraft}
          onTitleCommit={commitEdit}
          onTitleCancel={cancelEdit}
        />
        <CardMenu
          onOpen={() => onOpen(task.id)}
          onDelete={() => onDelete(task.id, task.title)}
          onEdit={startEdit}
          onAddSubtask={() => setAddingSubtask(true)}
        />
      </div>
      {addingSubtask && (
        <QuickSubtaskForm
          onSubmit={(title) => {
            onAddSubtask(task.id, title);
            setAddingSubtask(false);
          }}
          onCancel={() => setAddingSubtask(false)}
        />
      )}
    </div>
  );
});

/** Hover/focus card actions. Stops pointer/click from reaching the drag+open handlers. */
function CardMenu({
  onOpen,
  onDelete,
  onEdit,
  onAddSubtask,
}: {
  onOpen: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onAddSubtask: () => void;
}) {
  return (
    <div
      className="absolute right-1.5 top-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/sc:opacity-100"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Task actions"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-black/10 bg-white/90 text-[#64748b] shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-[#334155] data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onAddSubtask}>
            <CheckSquare className="h-4 w-4" /> Add subtask
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Inline "add a subtask" form, rendered below the card (sibling of the draggable node so drag/click handlers never intercept it). */
function QuickSubtaskForm({ onSubmit, onCancel }: { onSubmit: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  return (
    <div className="mt-1.5 rounded-lg border border-primary bg-surface p-2 shadow-sm">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const trimmed = title.trim();
            if (trimmed) onSubmit(trimmed);
            else onCancel();
          }
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={() => {
          if (!title.trim()) onCancel();
        }}
        placeholder="Subtask name…"
        className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs text-text outline-none placeholder:text-text-subtle"
      />
    </div>
  );
}

function AddStatusButton({ listId }: { listId: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-[288px] shrink-0 items-center gap-2 self-start rounded-2xl border border-dashed border-border-strong px-4 text-sm text-text-muted transition-colors hover:bg-glass hover:text-text"
        >
          <Plus className="h-4 w-4" /> Add / manage statuses
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <StatusManager listId={listId} />
      </PopoverContent>
    </Popover>
  );
}

/** Exposed so the list header can also open the status manager. */
export function StatusManagerButton({ listId }: { listId: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton aria-label="Manage statuses">
          <Settings2 className="h-4 w-4" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <StatusManager listId={listId} />
      </PopoverContent>
    </Popover>
  );
}


