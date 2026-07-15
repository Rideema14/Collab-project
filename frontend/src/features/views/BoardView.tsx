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
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { setOrder } from '@/store/slices/tasksSlice';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import type { TaskVM } from '@/lib/domain/types';
import { TaskCardContent } from '@/features/task/TaskCardContent';
import { useListData, type StatusColumn } from '@/features/list/useListData';
import { useListActions } from '@/features/list/useListActions';
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

export function BoardView({ listId }: { listId: string }) {
  const { columns } = useListData(listId);
  const { moveToStatus, deleteTask } = useListActions(listId);
  const dispatch = useAppDispatch();
  const commentsByTask = useAppSelector((s) => s.comments.byTaskId);
  const [activeTask, setActiveTask] = useState<TaskVM | null>(null);

  // Stable callbacks so memoized columns/cards don't re-render on every board render
  // (notably during a drag, when dnd-kit re-renders the DndContext continuously).
  const handleOpen = useCallback((id: number) => dispatch(openTask(id)), [dispatch]);
  const handleDelete = useCallback((id: number, title: string) => void deleteTask(id, title), [deleteTask]);

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
    setActiveTask(byId.get(Number(e.active.id))?.task ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = Number(active.id);
    const overId = String(over.id);
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
      <div className="flex h-full gap-3 overflow-x-auto overflow-y-hidden px-4 py-4">
        {columns.map((col) => (
          <BoardColumn
            key={col.status.id}
            column={col}
            listId={listId}
            commentsByTask={commentsByTask}
            onOpen={handleOpen}
            onDelete={handleDelete}
          />
        ))}
        <AddStatusButton listId={listId} />
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
        {activeTask && (
          <div className="w-72 cursor-grabbing">
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
}: {
  column: StatusColumn;
  listId: string;
  commentsByTask: Record<number, unknown[]>;
  onOpen: (id: number) => void;
  onDelete: (id: number, title: string) => void;
}) {
  const { theme } = useTheme();
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.status.id}` });
  const c = statusColors(column.status.hue, theme);

  return (
    <section className="flex w-72 shrink-0 animate-scale-in flex-col rounded-2xl border border-glass-border bg-glass">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.solid, boxShadow: `0 0 12px ${c.solid}` }} />
        <h3 className="text-sm font-semibold text-text">{column.status.name}</h3>
        <span
          className="rounded-full px-1.5 text-xs font-medium"
          style={{ backgroundColor: c.soft, color: c.onSoft }}
        >
          {column.tasks.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors',
          isOver && 'rounded-b-2xl bg-primary-soft/20 ring-2 ring-inset ring-[color:var(--color-primary)]/30'
        )}
      >
        <SortableContext items={column.tasks.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {column.tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                commentCount={commentsByTask[task.id]?.length ?? 0}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
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
}: {
  task: TaskVM;
  commentCount: number;
  onOpen: (id: number) => void;
  onDelete: (id: number, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
    data: { statusId: task.status.id },
  });

  return (
    <div className="animate-fade-in">
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn('group/sc relative cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen(task.id);
        }}
      >
        <TaskCardContent task={task} commentCount={commentCount} />
        <CardMenu onOpen={() => onOpen(task.id)} onDelete={() => onDelete(task.id, task.title)} />
      </div>
    </div>
  );
});

/** Hover/focus card actions. Stops pointer/click from reaching the drag+open handlers. */
function CardMenu({ onOpen, onDelete }: { onOpen: () => void; onDelete: () => void }) {
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
            className="flex h-6 w-6 items-center justify-center rounded-md border border-glass-border bg-surface-raised/85 text-text-subtle backdrop-blur transition-colors hover:text-text data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}>
            <Pencil className="h-4 w-4" /> Open
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AddStatusButton({ listId }: { listId: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-72 shrink-0 items-center gap-2 self-start rounded-2xl border border-dashed border-border-strong px-3 text-sm text-text-muted transition-colors hover:bg-glass hover:text-text"
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
