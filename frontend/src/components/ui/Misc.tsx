'use client';

import * as RSeparator from '@radix-ui/react-separator';
import { cn } from '@/lib/design/cn';

export function Separator({ className, orientation = 'horizontal', ...props }: RSeparator.SeparatorProps) {
  return (
    <RSeparator.Root
      orientation={orientation}
      className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} />;
}

/** A keyboard-key chip, e.g. for ⌘K hints. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-surface-muted px-1.5',
        'text-[11px] font-medium text-text-muted',
        className
      )}
    >
      {children}
    </kbd>
  );
}

/** A soft icon-button used across toolbars. */
export function IconButton({
  className,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors',
        'hover:bg-surface-muted hover:text-text',
        active && 'bg-surface-muted text-text',
        className
      )}
      {...props}
    />
  );
}
