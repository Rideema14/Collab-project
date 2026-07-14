import type { Board, Status, Task } from './types';
import { STATUSES } from './types';
import { dateOnly } from './format';

/**
 * Pure, immutable operations on the board.
 *
 * The board arrives from the server already grouped into columns, so the client
 * mirrors that shape rather than flattening and re-grouping it. Keeping these
 * transforms pure is what makes the optimistic drag safe: we snapshot the old
 * board, apply a transform, and on failure just restore the snapshot.
 */

export function emptyBoard(): Board {
  return { 'To Do': [], 'In Progress': [], Done: [] };
}

/** Finds a task anywhere on the board. */
export function findTask(board: Board, taskId: number): Task | null {
  for (const status of STATUSES) {
    const found = board[status].find((task) => task.id === taskId);
    if (found) return found;
  }
  return null;
}

export function totalTasks(board: Board): number {
  return STATUSES.reduce((sum, status) => sum + board[status].length, 0);
}

/** New tasks always land in 'To Do' — the backend hardcodes that on insert. */
export function addTask(board: Board, task: Task): Board {
  return { ...board, [task.status]: [...board[task.status], task] };
}

/**
 * Replaces a task by id, moving it between columns if its status changed.
 * Used for both the edit flow and for reconciling with the server's response
 * after a status change.
 */
export function replaceTask(board: Board, task: Task): Board {
  const next = removeTask(board, task.id);
  return { ...next, [task.status]: [...next[task.status], task] };
}

export function removeTask(board: Board, taskId: number): Board {
  const next = emptyBoard();
  for (const status of STATUSES) {
    next[status] = board[status].filter((task) => task.id !== taskId);
  }
  return next;
}

/**
 * The optimistic move: pull the task out of its column and drop it into the new
 * one immediately, so the card lands under the user's cursor with no wait.
 *
 * `isOverdue` is recomputed here to match the server's rule exactly
 * (`due_date < CURRENT_DATE AND status <> 'Done'`) — otherwise moving an
 * overdue task to Done would leave a stale red "Overdue" badge on the card
 * until the next refetch. The server's response then overwrites this anyway;
 * this only has to be right for the ~200ms in between.
 */
export function moveTask(board: Board, taskId: number, to: Status): Board {
  const task = findTask(board, taskId);
  if (!task || task.status === to) return board;

  const moved: Task = {
    ...task,
    status: to,
    isOverdue: to !== 'Done' && task.dueDate !== null && isPastDue(task.dueDate),
  };

  const without = removeTask(board, taskId);
  return { ...without, [to]: [...without[to], moved] };
}

/** Compares a 'YYYY-MM-DD' due date against today in local time. */
function isPastDue(dueDate: string): boolean {
  const [year, month, day] = dateOnly(dueDate).split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}
