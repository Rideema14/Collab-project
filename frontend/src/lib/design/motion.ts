import type { Transition, Variants } from 'framer-motion';

/**
 * The motion vocabulary for the whole app. Centralizing springs + variants keeps
 * animation consistent (one "feel") and makes every surface GPU-accelerated
 * (transform/opacity only) and reduced-motion-friendly.
 */

// ---- Spring presets ----
export const spring = {
  /** Snappy, for hover/press and small UI. */
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 } satisfies Transition,
  /** Smooth, for panels/drawers/cards. */
  smooth: { type: 'spring', stiffness: 260, damping: 30 } satisfies Transition,
  /** Soft, for large layout shifts and route transitions. */
  soft: { type: 'spring', stiffness: 170, damping: 26 } satisfies Transition,
  /** Bouncy, for playful confirmations. */
  bouncy: { type: 'spring', stiffness: 500, damping: 18, mass: 0.6 } satisfies Transition,
};

export const ease = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

// ---- Variants ----

/** Fade + rise. The default content entrance. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: ease.out } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.smooth },
  exit: { opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.14 } },
};

/** Parent that staggers its children in. Pair with `staggerItem`. */
export const staggerContainer = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } },
};

/** Route/page transition. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.out } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: ease.out } },
};

/** Card hover lift — use as whileHover. */
export const hoverLift = {
  y: -4,
  transition: spring.snappy,
};

/** Sidebar drawer (mobile) slide. */
export const drawerSlide: Variants = {
  hidden: { x: '-100%' },
  show: { x: 0, transition: spring.smooth },
  exit: { x: '-100%', transition: { duration: 0.2, ease: ease.out } },
};
