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
