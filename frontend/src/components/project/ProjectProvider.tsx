'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { projectsApi, tasksApi, usersApi } from '@/lib/api/endpoints';
import type { Board, Project, Status, Task, User } from '@/lib/types';
import { addTask, emptyBoard, findTask, moveTask, removeTask, replaceTask } from '@/lib/board';
import { useToast } from '@/lib/toast-context';
import { useAppDispatch } from '@/store/hooks';
import { addActivity, type ActivityKind } from '@/store/slices/activitySlice';
import { pushNotification } from '@/store/slices/notificationsSlice';

import { TaskFormModal } from '@/components/board/TaskFormModal';
import { VoiceTaskModal } from '@/components/board/VoiceTaskModal';
import { DeleteTaskDialog } from '@/components/board/DeleteTaskDialog';

type Phase = 'loading' | 'error' | 'ready';

interface ProjectContextValue {
  projectId: number;
  phase: Phase;
  errorMessage: string;
  project: Project | null;
  members: User[];
  board: Board;
  reload: () => void;
  /** Optimistic column move — the same flow the board drag uses. */
  moveTask: (taskId: number, to: Status) => void;
  openCreateTask: () => void;
  openEditTask: (task: Task) => void;
  openDeleteTask: (task: Task) => void;
  openVoice: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

/**
 * Owns everything shared across a project's views: the one board fetch, the
 * project + members, the optimistic mutations, and the create/edit/delete/voice
 * modals. Every tab (Overview, Board, List, Calendar, Analytics, Activity) reads
 * from here, so there's a single source of truth and the modals work identically
 * no matter which view you're on.
 */
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const { notify } = useToast();
  const dispatch = useAppDispatch();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [board, setBoard] = useState<Board>(emptyBoard);

  const [formOpen, setFormOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const logActivity = useCallback(
    (kind: ActivityKind, message: string) => {
      dispatch(addActivity({ projectId, kind, message, at: new Date().toISOString() }));
    },
    [dispatch, projectId]
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!Number.isInteger(projectId) || projectId <= 0) {
        setPhase('error');
        setErrorMessage('That project link is not valid.');
        return;
      }

      setPhase('loading');
      try {
        // No GET /api/projects/:id exists, so the project's name comes from the list.
        const [projects, memberList, boardData] = await Promise.all([
          projectsApi.list(signal),
          usersApi.list(signal),
          tasksApi.board(projectId, signal),
        ]);

        const found = projects.find((candidate) => candidate.id === projectId);
        if (!found) {
          setPhase('error');
          setErrorMessage('That project does not exist, or it was deleted.');
          return;
        }

        setProject(found);
        setMembers(memberList);
        setBoard(boardData);
        setPhase('ready');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401) return; // handled globally
        setPhase('error');
        setErrorMessage(error instanceof ApiError ? error.message : 'Could not load this board.');
      }
    },
    [projectId]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleMove = useCallback(
    async (taskId: number, to: Status) => {
      const snapshot = board;
      const task = findTask(snapshot, taskId);
      if (!task || task.status === to) return;

      setBoard((current) => moveTask(current, taskId, to));

      try {
        const updated = await tasksApi.updateStatus(taskId, to);
        setBoard((current) => replaceTask(current, updated));
        logActivity('moved', `Moved “${task.title}” to ${to}`);
      } catch (error) {
        setBoard(snapshot);
        notify(
          'error',
          error instanceof ApiError ? error.message : 'Could not move the task. Nothing changed.'
        );
      }
    },
    [board, notify, logActivity]
  );

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectId,
      phase,
      errorMessage,
      project,
      members,
      board,
      reload: () => void load(),
      moveTask: handleMove,
      openCreateTask: () => {
        setEditingTask(null);
        setFormOpen(true);
      },
      openEditTask: (task: Task) => {
        setEditingTask(task);
        setFormOpen(true);
      },
      openDeleteTask: (task: Task) => setDeletingTask(task),
      openVoice: () => setVoiceOpen(true),
    }),
    [projectId, phase, errorMessage, project, members, board, load, handleMove]
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}

      <TaskFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        projectId={projectId}
        members={members}
        task={editingTask}
        onSaved={(task) => {
          setBoard((current) => (editingTask ? replaceTask(current, task) : addTask(current, task)));
          logActivity(editingTask ? 'updated' : 'created', `${editingTask ? 'Updated' : 'Created'} “${task.title}”`);
          if (!editingTask) {
            dispatch(
              pushNotification({
                tone: 'success',
                title: 'Task created',
                body: task.title,
                href: `/projects/${projectId}/board`,
                createdAt: new Date().toISOString(),
              })
            );
          }
          setFormOpen(false);
          notify('success', editingTask ? 'Task updated.' : 'Task added.');
          setEditingTask(null);
        }}
      />

      <VoiceTaskModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        projectId={projectId}
        members={members}
        onCreated={(task) => {
          setBoard((current) => addTask(current, task));
          logActivity('created', `Created “${task.title}” by voice`);
          setVoiceOpen(false);
          notify('success', 'Task added from your voice command.');
        }}
      />

      <DeleteTaskDialog
        task={deletingTask}
        onClose={() => setDeletingTask(null)}
        onDeleted={(taskId) => {
          const removed = deletingTask;
          setBoard((current) => removeTask(current, taskId));
          if (removed) logActivity('deleted', `Deleted “${removed.title}”`);
          setDeletingTask(null);
          notify('success', 'Task deleted.');
        }}
      />
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used inside a <ProjectProvider>');
  }
  return context;
}
