'use client';

import * as RSA from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/design/cn';

export function ScrollArea({
  className,
  children,
  orientation = 'vertical',
  ...props
}: RSA.ScrollAreaProps & { orientation?: 'vertical' | 'horizontal' | 'both' }) {
  return (
    <RSA.Root className={cn('relative overflow-hidden', className)} {...props}>
      <RSA.Viewport className="h-full w-full [&>div]:!block">{children}</RSA.Viewport>
      {(orientation === 'vertical' || orientation === 'both') && <Bar orientation="vertical" />}
      {(orientation === 'horizontal' || orientation === 'both') && <Bar orientation="horizontal" />}
      <RSA.Corner />
    </RSA.Root>
  );
}

function Bar({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return (
    <RSA.Scrollbar
      orientation={orientation}
      className={cn(
        'flex touch-none select-none bg-transparent p-0.5 transition-colors',
        orientation === 'vertical' ? 'w-2' : 'h-2 flex-col'
      )}
    >
      <RSA.Thumb className="relative flex-1 rounded-full bg-border-strong" />
    </RSA.Scrollbar>
  );
}
