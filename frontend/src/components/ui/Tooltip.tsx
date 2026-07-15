'use client';

import * as RT from '@radix-ui/react-tooltip';
import { cn } from '@/lib/design/cn';

export const TooltipProvider = RT.Provider;
export const TooltipRoot = RT.Root;
export const TooltipTrigger = RT.Trigger;

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: RT.TooltipContentProps['side'];
}) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-toast max-w-xs rounded-md bg-text px-2 py-1 text-xs font-medium text-text-inverse shadow-md',
            'animate-fade-in'
          )}
        >
          {content}
          <RT.Arrow className="fill-text" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
