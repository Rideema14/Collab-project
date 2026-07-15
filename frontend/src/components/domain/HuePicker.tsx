'use client';

import { Check } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { statusColors, STATUS_HUES } from '@/lib/domain/status-color';
import { cn } from '@/lib/design/cn';

/** A swatch grid for choosing a status/tag hue. */
export function HuePicker({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (hue: number) => void;
  className?: string;
}) {
  const { theme } = useTheme();
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {STATUS_HUES.map((hue) => {
        const c = statusColors(hue, theme);
        const selected = ((value % 360) + 360) % 360 === hue;
        return (
          <button
            key={hue}
            type="button"
            aria-label={`Color ${hue}`}
            aria-pressed={selected}
            onClick={() => onChange(hue)}
            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{ backgroundColor: c.solid }}
          >
            {selected && <Check className="h-3.5 w-3.5" style={{ color: c.onSolid }} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
