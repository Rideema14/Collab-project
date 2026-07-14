'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { tasksApi } from '@/lib/api/endpoints';
import { dateOnly } from '@/lib/format';
import type { Task, User } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EMPTY_DRAFT, TaskDraft, TaskFields, draftToPayload } from './TaskFields';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  members: User[];
  /** Present => edit mode. Absent => create mode. */
  task?: Task | null;
  onSaved: (task: Task) => void;
}

function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    assigneeId: task.assignee ? String(task.assignee.id) : '',
    // dateOnly keeps the value in the exact format <input type="date"> accepts;
    // anything else it drops on the floor, which would clear the date on save.
    dueDate: task.dueDate ? dateOnly(task.dueDate) : '',
  };
}

export function TaskFormModal({
  open,
  onClose,
  projectId,
  members,
  task,
  onSaved,
}: TaskFormModalProps) {
  const isEdit = Boolean(task);

  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed the form whenever the dialog opens (with the task's values, or blank).
  useEffect(() => {
    if (!open) return;
    setDraft(task ? draftFromTask(task) : EMPTY_DRAFT);
    setTitleError(undefined);
    setFormError(null);
  }, [open, task]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const payload = draftToPayload(draft);
    if (!payload.title) {
      setTitleError('Task title is required.');
      return;
    }
    setTitleError(undefined);

    setSubmitting(true);
    try {
      // PATCH /api/tasks/:taskId accepts a partial body, but sending all three
      // fields is correct here: the form *is* the complete set of editable
      // fields, so anything the user cleared genuinely should be cleared.
      const saved = task
        ? await tasksApi.update(task.id, payload)
        : await tasksApi.create(projectId, payload);

      onSaved(saved);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : `Could not ${isEdit ? 'save' : 'create'} the task.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      title={isEdit ? 'Edit task' : 'Add task'}
      description={isEdit ? undefined : 'New tasks start in the To Do column.'}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <div
            role="alert"
            className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-fg"
          >
            {formError}
          </div>
        )}

        <TaskFields
          draft={draft}
          onChange={setDraft}
          members={members}
          titleError={titleError}
          disabled={submitting}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
