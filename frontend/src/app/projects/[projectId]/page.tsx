'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useParams } from 'next/navigation';
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

import { ApiError } from '@/lib/api/client';
import { projectsApi, tasksApi, usersApi } from '@/lib/api/endpoints';
import type { Board, Project, Status, Task, User } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { addTask, findTask, moveTask, removeTask, replaceTask, totalTasks } from '@/lib/board';
import { useToast } from '@/lib/toast-context';

import { RequireAuth } from '@/components/layout/RequireAuth';
import { AppHeader } from '@/components/layout/AppHeader';
import { BoardColumn } from '@/components/board/BoardColumn';
import { STATUS_STYLES } from '@/components/board/status-styles';
import { TaskCard } from '@/components/board/TaskCard';
import { TaskFormModal } from '@/components/board/TaskFormModal';
import { DeleteTaskDialog } from '@/components/board/DeleteTaskDialog';
import { VoiceTaskModal } from '@/components/board/VoiceTaskModal';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';

interface BoardData {
  project: Project;
  members: User[];
  board: Board;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: BoardData };

export default function BoardPage() {
  return (
    <RequireAuth>
      <AppHeader />
      <BoardView />
    </RequireAuth>
  );
}

function BoardView() {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const { notify } = useToast();

  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!Number.isInteger(projectId) || projectId <= 0) {
        setState({ phase: 'error', message: 'That project link is not valid.' });
        return;
      }

      setState({ phase: 'loading' });
      try {
        /*
         * There is no GET /api/projects/:id on the backend — only the list. To
         * show the project's name we fetch the list and pick ours out of it.
         * That's the honest way to work with the API as implemented; the
         * alternative would be inventing an endpoint that doesn't exist.
         * (Flagged as a missing API in the backend report.)
         */
        const [projects, members, board] = await Promise.all([
          projectsApi.list(signal),
          usersApi.list(signal),
          tasksApi.board(projectId, signal),
        ]);

        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project) {
          setState({ phase: 'error', message: 'That project does not exist, or it was deleted.' });
          return;
        }

        setState({ phase: 'ready', data: { project, members, board } });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401) return; // handled globally
        setState({
          phase: 'error',
          message: error instanceof ApiError ? error.message : 'Could not load this board.',
        });
      }
    },
    [projectId]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Applies a pure transform to the board without disturbing project/members. */
  const patchBoard = useCallback((transform: (board: Board) => Board) => {
    setState((current) =>
      current.phase === 'ready'
        ? { ...current, data: { ...current.data, board: transform(current.data.board) } }
        : current
    );
  }, []);

  /**
   * The optimistic move. The card lands in its new column immediately, then we
   * reconcile with the server's response (which recomputes isOverdue). If the
   * PATCH fails we put the board back exactly as it was and say so — a silent
   * revert would look like a bug.
   */
  const handleMove = useCallback(
    async (taskId: number, to: Status) => {
      if (state.phase !== 'ready') return;

      const snapshot = state.data.board;
      const task = findTask(snapshot, taskId);
      if (!task || task.status === to) return;

      patchBoard((board) => moveTask(board, taskId, to));

      try {
        const updated = await tasksApi.updateStatus(taskId, to);
        patchBoard((board) => replaceTask(board, updated));
      } catch (error) {
        patchBoard(() => snapshot);
        notify(
          'error',
          error instanceof ApiError ? error.message : 'Could not move the task. Nothing changed.'
        );
      }
    },
    [state, patchBoard, notify]
  );

  // A pointer drag must not fire on a plain click (the ⋮ menu lives on the card),
  // so require 6px of movement before a drag begins.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    if (state.phase !== 'ready') return;
    setDraggingTask(findTask(state.data.board, Number(event.active.id)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null);
    const { active, over } = event;
    if (!over) return; // Dropped outside any column — no change.

    const to = over.id as Status;
    if (!STATUSES.includes(to)) return;

    void handleMove(Number(active.id), to);
  }

  /**
   * Screen-reader narration for keyboard dragging. Without this a non-sighted
   * user picks up a card and hears nothing at all.
   */
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up task ${active.data.current?.title ?? active.id}.`,
    onDragOver: ({ over }) => (over ? `Over the ${over.id} column.` : 'Not over a column.'),
    onDragEnd: ({ over }) =>
      over ? `Dropped into ${over.id}.` : 'Dropped outside a column. Nothing changed.',
    onDragCancel: () => 'Move cancelled. The task stayed where it was.',
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href="/projects"
        className="mb-4 inline-flex rounded-sm text-sm text-text-muted hover:text-text"
      >
        ← All projects
      </Link>

      {state.phase === 'loading' && <BoardSkeleton />}

      {state.phase === 'error' && (
        <ErrorState message={state.message} onRetry={() => void load()} />
      )}

      {state.phase === 'ready' && (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-text sm:text-2xl">
                {state.data.project.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text-muted">
                <span>
                  {totalTasks(state.data.board)} task
                  {totalTasks(state.data.board) === 1 ? '' : 's'}
                </span>
                {/* A per-column tally, so the board's shape reads before you scan it. */}
                {STATUSES.map((status) => (
                  <span key={status} className="flex items-center gap-1.5 text-xs">
                    <span
                      aria-hidden="true"
                      className={clsx('h-1.5 w-1.5 rounded-full', STATUS_STYLES[status].dot)}
                    />
                    {state.data.board[status].length} {status}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setVoiceOpen(true)}>
                <span aria-hidden="true">🎤</span> Add by voice
              </Button>
              <Button
                onClick={() => {
                  setEditingTask(null);
                  setFormOpen(true);
                }}
              >
                <span aria-hidden="true">+</span> Add task
              </Button>
            </div>
          </div>

          {totalTasks(state.data.board) === 0 ? (
            <EmptyState
              title="This board is empty"
              message="Add your first task, by hand or by voice. New tasks start in To Do."
              action={
                <Button
                  onClick={() => {
                    setEditingTask(null);
                    setFormOpen(true);
                  }}
                >
                  Add the first task
                </Button>
              }
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              accessibility={{ announcements }}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDraggingTask(null)}
            >
              {/* Mobile-first: columns stack on a phone and sit side-by-side from md up. */}
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 md:gap-5">
                {STATUSES.map((status) => (
                  <BoardColumn
                    key={status}
                    status={status}
                    tasks={state.data.board[status]}
                    onMove={handleMove}
                    onEdit={(task) => {
                      setEditingTask(task);
                      setFormOpen(true);
                    }}
                    onDelete={setDeletingTask}
                    // Quick-add only on 'To Do' — the backend lands every new task there.
                    onAdd={
                      status === 'To Do'
                        ? () => {
                            setEditingTask(null);
                            setFormOpen(true);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>

              {/* The copy that follows the cursor, so the card isn't clipped by the column. */}
              <DragOverlay>
                {draggingTask && (
                  <TaskCard
                    overlay
                    task={draggingTask}
                    onMove={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}

          <TaskFormModal
            open={formOpen}
            onClose={() => setFormOpen(false)}
            projectId={projectId}
            members={state.data.members}
            task={editingTask}
            onSaved={(task) => {
              // Create appends; edit replaces in place. replaceTask also handles
              // the (impossible today) case of the status changing under us.
              patchBoard((board) => (editingTask ? replaceTask(board, task) : addTask(board, task)));
              setFormOpen(false);
              notify('success', editingTask ? 'Task updated.' : 'Task added.');
              setEditingTask(null);
            }}
          />

          <VoiceTaskModal
            open={voiceOpen}
            onClose={() => setVoiceOpen(false)}
            projectId={projectId}
            members={state.data.members}
            onCreated={(task) => {
              patchBoard((board) => addTask(board, task));
              setVoiceOpen(false);
              notify('success', 'Task added from your voice command.');
            }}
          />

          <DeleteTaskDialog
            task={deletingTask}
            onClose={() => setDeletingTask(null)}
            onDeleted={(taskId) => {
              patchBoard((board) => removeTask(board, taskId));
              setDeletingTask(null);
              notify('success', 'Task deleted.');
            }}
          />
        </>
      )}
    </main>
  );
}

/** LOADING: three skeleton columns, matching the real grid so nothing shifts. */
function BoardSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {STATUSES.map((status) => (
          <div key={status} className="flex flex-col gap-2">
            <Skeleton className="mb-1 h-5 w-28" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
