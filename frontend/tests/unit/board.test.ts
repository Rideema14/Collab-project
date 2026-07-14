import { describe, expect, it, vi, afterEach } from 'vitest';
import { addTask, emptyBoard, findTask, moveTask, removeTask, replaceTask, totalTasks } from '@/lib/board';
import type { Board, Task } from '@/lib/types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    projectId: 1,
    title: 'Fix the login bug',
    status: 'To Do',
    dueDate: null,
    isOverdue: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    assignee: null,
    ...overrides,
  };
}

function boardWith(...tasks: Task[]): Board {
  return tasks.reduce<Board>((acc, t) => addTask(acc, t), emptyBoard());
}

afterEach(() => vi.useRealTimers());

describe('board transforms', () => {
  it('starts with all three fixed columns, even when empty', () => {
    // The board must never be a bare {} — the UI renders the three columns
    // unconditionally, and a missing key would crash the map.
    expect(Object.keys(emptyBoard())).toEqual(['To Do', 'In Progress', 'Done']);
    expect(totalTasks(emptyBoard())).toBe(0);
  });

  it('adds a task into the column named by its own status', () => {
    const board = boardWith(task({ id: 7, status: 'In Progress' }));
    expect(board['In Progress']).toHaveLength(1);
    expect(board['To Do']).toHaveLength(0);
  });

  it('finds a task in any column, and returns null when absent', () => {
    const board = boardWith(task({ id: 7, status: 'Done' }));
    expect(findTask(board, 7)?.id).toBe(7);
    expect(findTask(board, 999)).toBeNull();
  });

  it('never mutates the board it was given', () => {
    const before = boardWith(task({ id: 1 }));
    const snapshot = structuredClone(before);

    moveTask(before, 1, 'Done');
    removeTask(before, 1);
    addTask(before, task({ id: 2 }));

    // This is what makes the optimistic move safe to revert: the pre-move board
    // is still intact, so restoring it is just setState(snapshot).
    expect(before).toEqual(snapshot);
  });

  it('moves a task between columns', () => {
    const moved = moveTask(boardWith(task({ id: 1 })), 1, 'Done');
    expect(moved['To Do']).toHaveLength(0);
    expect(moved.Done[0].status).toBe('Done');
  });

  it('is a no-op when the task is already in the target column', () => {
    const board = boardWith(task({ id: 1, status: 'Done' }));
    expect(moveTask(board, 1, 'Done')).toBe(board); // same reference: no re-render
  });

  it('is a no-op for an unknown task id', () => {
    const board = boardWith(task({ id: 1 }));
    expect(moveTask(board, 999, 'Done')).toBe(board);
  });

  /*
   * The overdue rules below mirror the server's SQL exactly:
   *   due_date < CURRENT_DATE AND status <> 'Done'
   * If these drift, an optimistically-moved card shows a stale badge for the
   * ~200ms before the server response lands.
   */
  describe('isOverdue during an optimistic move', () => {
    it('clears the overdue flag when a past-due task moves to Done', () => {
      vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14));
      const board = boardWith(task({ id: 1, dueDate: '2020-01-15', isOverdue: true }));

      expect(moveTask(board, 1, 'Done').Done[0].isOverdue).toBe(false);
    });

    it('restores the overdue flag when a past-due task moves back out of Done', () => {
      vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14));
      const board = boardWith(task({ id: 1, status: 'Done', dueDate: '2020-01-15', isOverdue: false }));

      expect(moveTask(board, 1, 'To Do')['To Do'][0].isOverdue).toBe(true);
    });

    it('does not flag a future-dated task as overdue', () => {
      vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14));
      const board = boardWith(task({ id: 1, dueDate: '2026-12-01' }));

      expect(moveTask(board, 1, 'In Progress')['In Progress'][0].isOverdue).toBe(false);
    });

    it('treats a task due today as NOT overdue (the server uses <, not <=)', () => {
      vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14, 23, 59));
      const board = boardWith(task({ id: 1, dueDate: '2026-07-14' }));

      expect(moveTask(board, 1, 'In Progress')['In Progress'][0].isOverdue).toBe(false);
    });

    it('never flags a task with no due date', () => {
      const board = boardWith(task({ id: 1, dueDate: null }));
      expect(moveTask(board, 1, 'In Progress')['In Progress'][0].isOverdue).toBe(false);
    });
  });

  it('replaceTask relocates a task whose status changed', () => {
    const board = boardWith(task({ id: 1, title: 'old' }));
    const next = replaceTask(board, task({ id: 1, title: 'new', status: 'Done' }));

    expect(next['To Do']).toHaveLength(0);
    expect(next.Done[0].title).toBe('new');
    expect(totalTasks(next)).toBe(1); // not duplicated across columns
  });

  it('removeTask deletes from whichever column holds it', () => {
    const board = boardWith(task({ id: 1, status: 'Done' }), task({ id: 2 }));
    const next = removeTask(board, 1);

    expect(totalTasks(next)).toBe(1);
    expect(findTask(next, 1)).toBeNull();
  });
});
