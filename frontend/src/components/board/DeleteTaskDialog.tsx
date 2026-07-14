'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { tasksApi } from '@/lib/api/endpoints';
import type { Task } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/**
 * Deleting is irreversible and the backend has no undo, so it gets an explicit
 * confirmation rather than an optimistic swipe.
 */
export function DeleteTaskDialog({
  task,
  onClose,
  onDeleted,
}: {
  task: Task | null;
  onClose: () => void;
  onDeleted: (taskId: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    if (!task) return;

    setSubmitting(true);
    setError(null);
    try {
      await tasksApi.remove(task.id);
      onDeleted(task.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the task.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={Boolean(task)}
      onClose={onClose}
      busy={submitting}
      title="Delete task?"
      description={task ? `“${task.title}” will be permanently removed.` : undefined}
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-fg"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={submitting}>
          {submitting ? 'Deleting…' : 'Delete task'}
        </Button>
      </div>
    </Modal>
  );
}
