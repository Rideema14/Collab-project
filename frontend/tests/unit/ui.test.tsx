import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { EmptyState, ErrorState } from '@/components/ui/States';

describe('Button', () => {
  it('prevents a double submit while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );

    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true'); // perceivable, not just visual

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it cannot accidentally submit a form', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveAttribute('type', 'button');
  });

  it('fires normally when idle', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add task</Button>);

    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Field', () => {
  it('links the label to the control, so clicking the label focuses the input', async () => {
    render(
      <Field label="Task title">
        {({ inputId, describedBy, invalid }) => (
          <Input id={inputId} aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>
    );

    // getByLabelText only resolves if the label/for wiring is genuinely correct.
    const input = screen.getByLabelText('Task title');
    await userEvent.click(screen.getByText('Task title'));
    expect(input).toHaveFocus();
  });

  it('announces an error via aria-invalid + aria-describedby, not colour alone', () => {
    render(
      <Field label="Email" error="Enter your email address.">
        {({ inputId, describedBy, invalid }) => (
          <Input id={inputId} aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // A red border is invisible to a screen reader; the message must be attached.
    expect(input).toHaveAccessibleDescription('Enter your email address.');
  });

  it('hides the hint once an error takes its place', () => {
    const { rerender } = render(
      <Field label="Password" hint="At least 6 characters.">
        {({ inputId, describedBy }) => <Input id={inputId} aria-describedby={describedBy} />}
      </Field>
    );
    expect(screen.getByText('At least 6 characters.')).toBeInTheDocument();

    rerender(
      <Field label="Password" hint="At least 6 characters." error="Too short.">
        {({ inputId, describedBy }) => <Input id={inputId} aria-describedby={describedBy} />}
      </Field>
    );
    expect(screen.queryByText('At least 6 characters.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Too short.');
  });
});

describe('the four UI states', () => {
  it('EmptyState offers a next action instead of a dead end', () => {
    render(
      <EmptyState
        title="No projects yet"
        message="Create your first project."
        action={<Button>Create a project</Button>}
      />
    );

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create a project/i })).toBeInTheDocument();
  });

  it('ErrorState is announced as an alert and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load this board." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this board.');

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('ErrorState omits the retry button when there is nothing to retry', () => {
    render(<ErrorState message="That project link is not valid." />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});
