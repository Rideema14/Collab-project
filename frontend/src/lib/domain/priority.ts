import { PRIORITY_META } from './defaults';
import { daysUntilDue } from '@/lib/format';
import type { Priority, TaskVM } from './types';

/**
 * Priority derived purely from the deadline: the closer (or more overdue) an
 * incomplete task is, the higher it gets. Completed tasks apply no pressure.
 */
export function deadlinePriority(task: TaskVM): Priority {
  if (task.status.group === 'done') return 'none';
  const days = daysUntilDue(task.dueDate);
  if (task.isOverdue || days <= 0) return 'urgent';
  if (days <= 2) return 'high';
  if (days <= 5) return 'normal';
  return 'none';
}

/**
 * The priority actually used to colour and sort a task: it auto-escalates with the
 * deadline while never dropping below what the user set manually — so priority
 * "changes by itself according to date", yet a manual bump is always respected.
 * (Lower PRIORITY_META.rank = more urgent, so we take the smaller rank.)
 */
export function effectivePriority(task: TaskVM): Priority {
  const manual = task.rich.priority;
  const byDate = deadlinePriority(task);
  return PRIORITY_META[manual].rank <= PRIORITY_META[byDate].rank ? manual : byDate;
}
