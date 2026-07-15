'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/design/cn';
import { spring } from '@/lib/design/motion';

/** A completion ring with the brand gradient stroke and an animated sweep. */
export function Ring({
  percent,
  size = 128,
  stroke = 12,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const id = useId();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circ;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--violet-500)" />
            <stop offset="50%" stopColor="var(--indigo-500)" />
            <stop offset="100%" stopColor="var(--cyan-400)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-glass-border" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${id})`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${filled} ${circ}` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** A mini animated bar chart for trends. */
export function Sparkbars({
  data,
  className,
}: {
  data: { label: string; count: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className={cn('flex h-24 items-end gap-1.5', className)}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.count / max) * 100}%` }}
              transition={{ ...spring.smooth, delay: i * 0.04 }}
              className="w-full rounded-md bg-gradient-brand"
              style={{ minHeight: d.count > 0 ? 6 : 2, opacity: d.count > 0 ? 1 : 0.25 }}
              title={`${d.count}`}
            />
          </div>
          <span className="text-[10px] text-text-subtle">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A labeled horizontal meter. */
export function Meter({
  value,
  max = 100,
  color = 'var(--color-primary)',
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-glass-border', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={spring.smooth}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}
