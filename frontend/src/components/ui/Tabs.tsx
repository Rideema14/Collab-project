'use client';

import * as RTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/design/cn';

export const Tabs = RTabs.Root;

export function TabsList({ className, ...props }: RTabs.TabsListProps) {
  return (
    <RTabs.List
      className={cn('inline-flex items-center gap-1 rounded-lg bg-surface-muted p-1', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: RTabs.TabsTriggerProps) {
  return (
    <RTabs.Trigger
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition-colors',
        'hover:text-text data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export const TabsContent = RTabs.Content;
