'use client';

import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/design/cn';

/**
 * A right-side slide-over built on Radix Dialog (focus trap, ESC, scroll-lock,
 * a11y handled). Used for task detail.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  width = 'w-full max-w-xl',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-overlay bg-overlay animate-fade-in" />
        <RDialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-modal flex flex-col border-l border-border bg-surface shadow-lg',
            'data-[state=open]:animate-scale-in focus:outline-none',
            width
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <RDialog.Title asChild>
              <div className="min-w-0 flex-1">{title}</div>
            </RDialog.Title>
            <RDialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
