'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/design/cn';

/** Text input on the semantic token layer. Inherits the global focus ring. */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text',
          'placeholder:text-text-subtle',
          'transition-colors hover:border-border-strong focus:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-55',
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text',
          'placeholder:text-text-subtle',
          'transition-colors hover:border-border-strong focus:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-55',
          className
        )}
        {...props}
      />
    );
  }
);
