'use client';

import * as RPop from '@radix-ui/react-popover';
import { cn } from '@/lib/design/cn';

export const Popover = RPop.Root;
export const PopoverTrigger = RPop.Trigger;
export const PopoverAnchor = RPop.Anchor;
export const PopoverClose = RPop.Close;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}: RPop.PopoverContentProps) {
  return (
    <RPop.Portal>
      <RPop.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-dropdown w-72 rounded-xl border border-border bg-surface-raised p-3 shadow-lg',
          'max-w-[var(--radix-popover-content-available-width)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto',
          'animate-scale-in focus:outline-none',
          className
        )}
        {...props}
      />
    </RPop.Portal>
  );
}
