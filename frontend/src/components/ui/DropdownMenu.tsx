'use client';

import * as RDM from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/design/cn';

/** Thin token-styled wrappers over Radix DropdownMenu. */
export const DropdownMenu = RDM.Root;
export const DropdownMenuTrigger = RDM.Trigger;
export const DropdownMenuGroup = RDM.Group;

export function DropdownMenuContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: RDM.DropdownMenuContentProps) {
  return (
    <RDM.Portal>
      <RDM.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-dropdown min-w-[11rem] overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-lg',
          'animate-scale-in',
          className
        )}
        {...props}
      />
    </RDM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  destructive,
  ...props
}: RDM.DropdownMenuItemProps & { inset?: boolean; destructive?: boolean }) {
  return (
    <RDM.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none',
        'text-text transition-colors focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        destructive && 'text-danger focus:bg-danger-soft focus:text-danger-fg',
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: RDM.DropdownMenuLabelProps) {
  return (
    <RDM.Label
      className={cn('px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-text-subtle', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: RDM.DropdownMenuSeparatorProps) {
  return <RDM.Separator className={cn('my-1 h-px bg-border', className)} {...props} />;
}
