'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/design/cn';
import { fadeInUp, hoverLift, pageTransition, spring, staggerContainer, staggerItem } from '@/lib/design/motion';

/** Wrap a page body to get a smooth route-transition entrance. */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={pageTransition} initial="hidden" animate="show" exit="exit" className={cn('h-full', className)}>
      {children}
    </motion.div>
  );
}

/** A container that staggers its children in on mount. */
export function Stagger({
  children,
  className,
  stagger = 0.05,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div variants={staggerContainer(stagger, delay)} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...props }: HTMLMotionProps<'div'> & { className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  );
}

/** A single fade-in-up element (no stagger parent needed). */
export function FadeInUp({ children, className, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="show" className={className} {...props}>
      {children}
    </motion.div>
  );
}

/** A card that lifts on hover and presses on tap — the standard interactive surface. */
export function HoverCard({
  children,
  className,
  lift = true,
  ...props
}: HTMLMotionProps<'div'> & { lift?: boolean }) {
  return (
    <motion.div
      whileHover={lift ? hoverLift : undefined}
      whileTap={{ scale: 0.99 }}
      className={cn('will-change-transform', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * A magnetic button: the content drifts toward the cursor and springs back on
 * leave. Pure transform (GPU), spring-damped. Wrap any button/link.
 */
export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, spring.snappy);
  const sy = useSpring(y, spring.snappy);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      className={cn('inline-flex will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
}

/** Frosted glass panel with optional glow border. */
export function GlassPanel({
  children,
  className,
  glow = false,
  strong = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-2xl shadow-glass',
        glow && 'shadow-glow',
        className
      )}
    >
      {children}
    </div>
  );
}
