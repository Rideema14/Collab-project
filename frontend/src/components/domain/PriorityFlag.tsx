'use client';

import { Flag } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { statusColors } from '@/lib/domain/status-color';
import { PRIORITY_META } from '@/lib/domain/defaults';
import { cn } from '@/lib/design/cn';
import type { Priority } from '@/lib/domain/types';

export function PriorityFlag({
  priority,
  withLabel = false,
  className,
}: {
  priority: Priority;
  withLabel?: boolean;
  className?: string;
}) {
  const { theme } = useTheme();
  const meta = PRIORITY_META[priority];
  if (priority === 'none' && !withLabel) return null;
  const color = statusColors(meta.hue, theme).solid;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <Flag className="h-3.5 w-3.5" style={{ color: priority === 'none' ? undefined : color }} fill={priority === 'none' ? 'none' : color} />
      {withLabel && <span className="text-text-muted">{meta.label}</span>}
    </span>
  );
}

/** A compact colored priority pill for cards. Renders nothing for 'none'. */
export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const { theme } = useTheme();
  if (priority === 'none') return null;
  const meta = PRIORITY_META[priority];
  const c = statusColors(meta.hue, theme);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', className)}
      style={{ backgroundColor: c.soft, color: c.onSoft }}
    >
      <Flag className="h-3 w-3" fill={c.solid} style={{ color: c.solid }} />
      {meta.label}
    </span>
  );
}
