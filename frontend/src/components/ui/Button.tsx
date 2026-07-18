'use client';

import clsx from 'clsx';
import { forwardRef } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Shows a spinner AND disables the button. This is the double-submit guard
   * the Playbook asks for — every mutating form in the app routes its pending
   * state through here rather than reimplementing it.
   */
  loading?: boolean;
  fullWidth?: boolean;
}

/*
 * Props-driven, not copy-driven (Playbook, Phase 4). One Button, three axes:
 * variant × size × state. There is no second button component anywhere.
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover border-transparent shadow-sm hover:shadow-md',
  secondary: 'bg-surface text-text border-border-strong hover:bg-surface-muted shadow-sm',
  ghost: 'bg-transparent text-text-muted border-transparent hover:bg-surface-muted hover:text-text',
  danger: 'bg-danger text-primary-fg hover:bg-danger-hover border-transparent shadow-sm hover:shadow-md',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className, children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      // Tells assistive tech the control is working, not broken.
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center rounded-pill border font-semibold transition-all duration-150 ease-out active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});
