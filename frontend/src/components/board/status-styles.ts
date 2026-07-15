import type { Status } from '@/lib/types';

/**
 * The one place a status is mapped to a colour. The column header, its accent
 * bar and the card's left stripe all read from here, so a status can never be
 * blue in one place and green in another.
 *
 * Only semantic tokens — no raw palette values — so dark mode stays a token swap.
 */
interface StatusStyle {
  /** The column's top accent bar and the card's left stripe. */
  bar: string;
  /** The dot in the column header. */
  dot: string;
  /** The tinted count chip in the column header. */
  chip: string;
}

export const STATUS_STYLES: Record<Status, StatusStyle> = {
  'To Do': {
    bar: 'bg-border-strong',
    dot: 'bg-text-subtle',
    chip: 'bg-surface-muted text-text-muted',
  },
  'In Progress': {
    bar: 'bg-primary',
    dot: 'bg-primary',
    chip: 'bg-primary-soft text-primary-on-soft',
  },
  Done: {
    bar: 'bg-success',
    dot: 'bg-success',
    chip: 'bg-success-soft text-success-fg',
  },
};
