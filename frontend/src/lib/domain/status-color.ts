/**
 * Derives an accessible color triad from a single hue, so a custom status (or tag)
 * needs to store only a number. Everything is computed in HSL and tuned to clear
 * WCAG AA contrast in BOTH themes — the soft background + foreground pair is the
 * risky one, so the foreground lightness is pushed hard away from the background.
 *
 * Returned as inline style values (not Tailwind classes) because the hue is
 * dynamic and user-chosen — Tailwind can't enumerate it at build time.
 */

export interface StatusColors {
  /** Solid dot / bar — the status's identity color. */
  solid: string;
  /** Tinted surface behind a chip/column header. */
  soft: string;
  /** Text/icon sitting on `soft`. */
  onSoft: string;
  /** Text sitting on `solid`. */
  onSolid: string;
  /** Subtle border for a chip on the page background. */
  ring: string;
}

/** A curated hue palette for quick-pick swatches (evenly spread, distinct). */
export const STATUS_HUES = [211, 262, 291, 330, 0, 24, 45, 142, 168, 199] as const;

/**
 * A soft, muted accent set for dark surfaces — deliberately low-saturation so the
 * board reads as sophisticated and eye-friendly rather than neon. Derived from a
 * single hue: a thin accent line, a calm dot, a faint header wash, and a chip pair.
 */
export function softAccent(hue: number) {
  const h = ((hue % 360) + 360) % 360;
  return {
    line: `hsl(${h} 42% 56%)`,
    dot: `hsl(${h} 40% 60%)`,
    wash: `hsl(${h} 34% 30% / 0.14)`,
    chipBg: `hsl(${h} 26% 26% / 0.5)`,
    chipText: `hsl(${h} 44% 78%)`,
  };
}

/**
 * Colourful card palette for a DARK board: a deep tinted surface, a brighter
 * accent rail, and light readable text. Low-ish saturation so it's rich but calm
 * (not neon) against the dark board. Keyed by hue (red/blue/green by priority).
 */
export function colorCardDark(hue: number) {
  const h = ((hue % 360) + 360) % 360;
  return {
    bg: `hsl(${h} 44% 13%)`,
    border: `hsl(${h} 38% 26%)`,
    rail: `hsl(${h} 60% 60%)`,
    title: '#eef1f7',
    meta: `hsl(${h} 22% 70%)`,
    chipBg: `hsl(${h} 40% 20%)`,
    chipText: `hsl(${h} 55% 80%)`,
  };
}

/**
 * Vibrant light card palette (Bordio-style): a lively — not neon — tinted surface
 * with a stronger left rail and dark readable text. Used on the light project
 * board, keyed by hue (red/blue/green by priority).
 */
export function vividCard(hue: number) {
  const h = ((hue % 360) + 360) % 360;
  return {
    bg: `hsl(${h} 85% 93%)`,
    border: `hsl(${h} 60% 82%)`,
    rail: `hsl(${h} 66% 55%)`,
    title: `hsl(${h} 42% 26%)`,
    meta: `hsl(${h} 24% 42%)`,
    chipBg: `hsl(${h} 72% 88%)`,
    chipText: `hsl(${h} 46% 34%)`,
    /** Same hue as the card, a few shades darker — for dividers on the card. */
    divider: `hsl(${h} 58% 80%)`,
  };
}

export function statusColors(hue: number, theme: 'light' | 'dark' = 'light'): StatusColors {
  const h = ((hue % 360) + 360) % 360;
  if (theme === 'dark') {
    return {
      solid: `hsl(${h} 70% 60%)`,
      soft: `hsl(${h} 45% 22% / 0.55)`,
      onSoft: `hsl(${h} 80% 82%)`,
      onSolid: `hsl(${h} 40% 12%)`,
      ring: `hsl(${h} 40% 40% / 0.6)`,
    };
  }
  return {
    solid: `hsl(${h} 68% 48%)`,
    soft: `hsl(${h} 78% 96%)`,
    onSoft: `hsl(${h} 72% 32%)`,
    onSolid: `hsl(0 0% 100%)`,
    ring: `hsl(${h} 60% 82%)`,
  };
}
