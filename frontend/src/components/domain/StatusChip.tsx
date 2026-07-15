'use client';

import { useTheme } from '@/lib/theme-context';
import { statusColors } from '@/lib/domain/status-color';
import { cn } from '@/lib/design/cn';
import type { StatusDef } from '@/lib/domain/types';

/** A colored dot for a status/tag hue. */
export function Dot({ hue, className }: { hue: number; className?: string }) {
  const { theme } = useTheme();
  const c = statusColors(hue, theme);
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: c.solid }}
    />
  );
}

/** A soft status chip with a dot + label, colored from the status hue. */
export function StatusChip({
  status,
  className,
  solid = false,
}: {
  status: StatusDef;
  className?: string;
  solid?: boolean;
}) {
  const { theme } = useTheme();
  const c = statusColors(status.hue, theme);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={
        solid
          ? { backgroundColor: c.solid, color: c.onSolid }
          : { backgroundColor: c.soft, color: c.onSoft }
      }
    >
      {!solid && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.solid }} />}
      {status.name}
    </span>
  );
}
