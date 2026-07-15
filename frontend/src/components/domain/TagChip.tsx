'use client';

import { useTheme } from '@/lib/theme-context';
import { statusColors } from '@/lib/domain/status-color';
import { cn } from '@/lib/design/cn';
import type { Tag } from '@/lib/domain/types';

export function TagChip({ tag, className }: { tag: Tag; className?: string }) {
  const { theme } = useTheme();
  const c = statusColors(tag.hue, theme);
  return (
    <span
      className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', className)}
      style={{ backgroundColor: c.soft, color: c.onSoft }}
    >
      {tag.label}
    </span>
  );
}
