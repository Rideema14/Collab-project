'use client';

import type { User } from '@/lib/types';
import { Field, Input, Select } from '@/components/ui/Field';

export interface TaskDraft {
  title: string;
  /** '' means unassigned — the backend maps an empty string to NULL. */
  assigneeId: string;
  /** '' means no due date. */
  dueDate: string;
}

export const EMPTY_DRAFT: TaskDraft = { title: '', assigneeId: '', dueDate: '' };

/**
 * The three task fields, shared by the manual "Add task" form and the voice
 * confirmation step. Voice is just a second way to fill in this one form, so it
 * must be the same form — not a lookalike that drifts.
 */
export function TaskFields({
  draft,
  onChange,
  members,
  titleError,
  disabled,
}: {
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  members: User[];
  titleError?: string;
  disabled?: boolean;
}) {
  return (
    <>
      <Field label="Task title" error={titleError} required>
        {({ inputId, describedBy, invalid }) => (
          <Input
            id={inputId}
            aria-describedby={describedBy}
            invalid={invalid}
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="Fix the login redirect bug"
            maxLength={500}
            disabled={disabled}
          />
        )}
      </Field>

      <Field label="Assign to" hint="Leave unassigned if nobody owns it yet.">
        {({ inputId, describedBy }) => (
          <Select
            id={inputId}
            aria-describedby={describedBy}
            value={draft.assigneeId}
            onChange={(e) => onChange({ ...draft, assigneeId: e.target.value })}
            disabled={disabled}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={String(member.id)}>
                {member.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Due date">
        {({ inputId, describedBy }) => (
          <Input
            id={inputId}
            aria-describedby={describedBy}
            type="date"
            value={draft.dueDate}
            onChange={(e) => onChange({ ...draft, dueDate: e.target.value })}
            disabled={disabled}
          />
        )}
      </Field>
    </>
  );
}

/**
 * Converts the form's string values into the exact JSON the backend expects.
 * The API treats null as "clear this field", so '' has to become null here
 * rather than being sent as an empty string.
 */
export function draftToPayload(draft: TaskDraft): {
  title: string;
  assigneeId: number | null;
  dueDate: string | null;
} {
  return {
    title: draft.title.trim(),
    assigneeId: draft.assigneeId ? Number(draft.assigneeId) : null,
    dueDate: draft.dueDate || null,
  };
}
