'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

import type { Status, Task } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { findTask, totalTasks } from '@/lib/board';
import { BoardColumn } from '@/components/board/BoardColumn';
import { TaskCard } from '@/components/board/TaskCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { useProject } from '../ProjectProvider';

export function BoardView() {
  const { board, moveTask, openCreateTask, openEditTask, openDeleteTask } = useProject();
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  // A pointer drag must not fire on a plain click (the ⋮ menu lives on the card),
  // so require 6px of movement before a drag begins.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggingTask(findTask(board, Number(event.active.id)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null);
    const { active, over } = event;
    if (!over) return; // Dropped outside any column — no change.
    const to = over.id as Status;
    if (!STATUSES.includes(to)) return;
    moveTask(Number(active.id), to);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up task ${active.data.current?.title ?? active.id}.`,
    onDragOver: ({ over }) => (over ? `Over the ${over.id} column.` : 'Not over a column.'),
    onDragEnd: ({ over }) =>
      over ? `Dropped into ${over.id}.` : 'Dropped outside a column. Nothing changed.',
    onDragCancel: () => 'Move cancelled. The task stayed where it was.',
  };

  if (totalTasks(board) === 0) {
    return (
      <EmptyState
        title="This board is empty"
        message="Add your first task, by hand or by voice. New tasks start in To Do."
        action={<Button onClick={openCreateTask}>Add the first task</Button>}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingTask(null)}
    >
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 md:gap-5">
        {STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={board[status]}
            onMove={moveTask}
            onEdit={openEditTask}
            onDelete={openDeleteTask}
            onAdd={status === 'To Do' ? openCreateTask : undefined}
          />
        ))}
      </div>

      <DragOverlay>
        {draggingTask && (
          <TaskCard overlay task={draggingTask} onMove={() => {}} onEdit={() => {}} onDelete={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
