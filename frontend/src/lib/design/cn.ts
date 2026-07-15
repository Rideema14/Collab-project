import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The one class-merge helper for the whole design system. `clsx` handles
 * conditionals; `twMerge` resolves Tailwind conflicts so a later class wins
 * (e.g. `cn('px-2', condition && 'px-4')` yields `px-4`, not both).
 *
 * Our Tailwind palette is fully semantic (see tailwind.config.ts), so this
 * merges token classes, never raw hexes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
