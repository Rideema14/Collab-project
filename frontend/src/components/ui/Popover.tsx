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
  ...props
}: RPop.PopoverContentProps) {
  return (
    <RPop.Portal>
      <RPop.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-dropdown w-72 rounded-xl border border-border bg-surface-raised p-3 shadow-lg',
          'animate-scale-in focus:outline-none',
          className
        )}
        {...props}
      />
    </RPop.Portal>
  );
}
