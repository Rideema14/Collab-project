'use client';

import * as RCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/design/cn';

export function Checkbox({ className, ...props }: RCheckbox.CheckboxProps) {
  return (
    <RCheckbox.Root
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface',
        'transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        'focus-visible:outline-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      <RCheckbox.Indicator>
        <Check className="h-3 w-3 text-primary-fg" strokeWidth={3} />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}
