'use client';

import { useMemo, useState } from 'react';
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
import { motion } from 'framer-motion';
import { Plus, Settings2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTask } from '@/store/slices/uiSlice';
import { setOrder } from '@/store/slices/tasksSlice';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import { spring, staggerContainer, staggerItem } from '@/lib/design/motion';
import type { StatusDef, TaskVM } from '@/lib/domain/types';
import { TaskCardContent } from '@/features/task/TaskCardContent';
import { useListData, type StatusColumn } from '@/features/list/useListData';
import { useListActions } from '@/features/list/useListActions';
import { StatusManager } from '@/features/statuses/StatusManager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { IconButton } from '@/components/ui/Misc';
import { QuickAddTask } from '@/features/list/QuickAddTask';

export function BoardView({ listId }: { listId: string }) {
  const { columns, statusSet } = useListData(listId);
  const { moveToStatus } = useListActions(listId);
  const dispatch = useAppDispatch();
  const commentsByTask = useAppSelector((s) => s.comments.byTaskId);
  const [activeTask, setActiveTask] = useState<TaskVM | null>(null);

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
            commentCount={(id) => commentsByTask[id]?.length ?? 0}
            onOpen={(id) => dispatch(openTask(id))}
          />
        ))}
        <AddStatusButton setId={statusSet.id} />
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
        {activeTask && (
          <div className="w-72">
            <TaskCardContent task={activeTask} overlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  column,
  listId,
  commentCount,
  onOpen,
}: {
  column: StatusColumn;
  listId: string;
  commentCount: (id: number) => number;
  onOpen: (id: number) => void;
}) {
  const { theme } = useTheme();
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.status.id}` });
  const c = statusColors(column.status.hue, theme);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className="flex w-72 shrink-0 flex-col rounded-2xl border border-glass-border bg-glass"
    >
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
          isOver && 'rounded-b-2xl bg-primary-soft/25'
        )}
      >
        <SortableContext items={column.tasks.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
          <motion.div variants={staggerContainer(0.04)} initial="hidden" animate="show" className="space-y-2">
            {column.tasks.map((task) => (
              <SortableCard key={task.id} task={task} commentCount={commentCount(task.id)} onOpen={onOpen} />
            ))}
          </motion.div>
        </SortableContext>
        <QuickAddTask listId={listId} statusId={column.status.id} />
      </div>
    </motion.section>
  );
}

function SortableCard({
  task,
  commentCount,
  onOpen,
}: {
  task: TaskVM;
  commentCount: number;
  onOpen: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
    data: { statusId: task.status.id },
  });

  return (
    <motion.div variants={staggerItem}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn('cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
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
      </div>
    </motion.div>
  );
}

function AddStatusButton({ setId }: { setId: string }) {
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
        <StatusManager setId={setId} />
      </PopoverContent>
    </Popover>
  );
}

/** Exposed so the list header can also open the status manager. */
export function StatusManagerButton({ setId }: { setId: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton aria-label="Manage statuses">
          <Settings2 className="h-4 w-4" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <StatusManager setId={setId} />
      </PopoverContent>
    </Popover>
  );
}
