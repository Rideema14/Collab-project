'use client';

import clsx from 'clsx';
import { forwardRef, useId } from 'react';

/*
 * Form controls, built so the accessible wiring is impossible to forget:
 * every input gets a real <label htmlFor>, and every error is tied to its
 * field with aria-describedby + aria-invalid — "clear errors next to fields,
 * not vague banners" (Playbook, Forms & Validation).
 */

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (ids: { inputId: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldShellProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      {children({ inputId, describedBy, invalid: Boolean(error) })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_CLASSES =
  'w-full rounded-md border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle disabled:cursor-not-allowed disabled:opacity-60';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(CONTROL_CLASSES, invalid ? 'border-danger' : 'border-border-strong', className)}
      {...rest}
    />
  );
});

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(
        CONTROL_CLASSES,
        'h-10 appearance-none bg-[length:1rem] pr-8',
        invalid ? 'border-danger' : 'border-border-strong',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
