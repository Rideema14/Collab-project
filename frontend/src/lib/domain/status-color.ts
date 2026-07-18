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

/**
 * TWO-HUE BRAND SYSTEM — the app is drawn in black, white, and two hues only:
 * PEAR GREEN and YELLOW. Every generator ignores the *actual* stored hue for the
 * H channel and emits a shade of green OR yellow (alternating by shade step so
 * distinct statuses/tags stay distinguishable). Both hues are bright, so text
 * that sits ON a solid fill is always near-black, never white.
 */
const GREEN_H = 68;
const YELLOW_H = 46;

/** Stored hue (0..360) → a small deterministic shade step (0..4). */
function shadeStep(hue: number): number {
  const h = ((hue % 360) + 360) % 360;
  return Math.floor(h / 72) % 5;
}

/** Pick green or yellow from the stored hue so adjacent items differ. */
function brandHue(hue: number): number {
  return shadeStep(hue) % 2 === 0 ? GREEN_H : YELLOW_H;
}

/** Swatch values kept as-is; they now map to five orange shades via shadeStep. */
export const STATUS_HUES = [211, 262, 291, 330, 0, 24, 45, 142, 168, 199] as const;

/** Chart/meter series — cycled through statusColors(), so each series is a
 *  distinct shade of the single brand orange. */
export const DATAVIZ_HUES = [0, 72, 144, 216] as const;

/**
 * Green/yellow accent set for the list header rail/dot/wash — a shade of one of
 * the two brand hues, varied slightly per stored hue.
 */
export function softAccent(hue: number) {
  const h = brandHue(hue);
  const step = shadeStep(hue);
  return {
    line: `hsl(${h} 70% ${46 + step * 2}%)`,
    dot: `hsl(${h} 68% ${50 + step * 2}%)`,
    wash: `hsl(${h} 55% 40% / 0.14)`,
    chipBg: `hsl(${h} 40% 30% / 0.5)`,
    chipText: `hsl(${h} 70% 78%)`,
  };
}

/**
 * Solid task-card palette keyed by priority INTENSITY: urgent = bright YELLOW
 * (attention), then bold → pale PEAR GREEN. Both hues are bright, so the title
 * and meta text are dark green/olive. Fully opaque, no alpha. Both boards.
 */
export function vividCard(level: number) {
  const l = Math.max(0, Math.min(3, Math.round(level)));
  const h = l === 0 ? YELLOW_H : GREEN_H;
  const bgL = [82, 80, 85, 90][l];
  const bgS = [92, 72, 66, 60][l];
  return {
    bg: `hsl(${h} ${bgS}% ${bgL}%)`,
    border: `hsl(${h} 60% ${bgL - 12}%)`,
    rail: `hsl(${h} 72% 42%)`,
    title: `hsl(${h} 45% 22%)`,
    meta: `hsl(${h} 32% 34%)`,
    chipBg: `hsl(${h} 70% ${bgL - 6}%)`,
    chipText: `hsl(${h} 50% 24%)`,
    /** Same hue, a few shades darker — for dividers on the card. */
    divider: `hsl(${h} 52% ${bgL - 14}%)`,
  };
}

export function statusColors(hue: number, theme: 'light' | 'dark' = 'light'): StatusColors {
  // Green or yellow, picked from the stored hue; text on the bright solid is
  // always dark (never white).
  const h = brandHue(hue);
  const step = shadeStep(hue);
  if (theme === 'dark') {
    return {
      solid: `hsl(${h} 78% ${52 + step * 3}%)`,
      soft: `hsl(${h} 46% ${26 + step * 2}%)`,
      onSoft: `hsl(${h} 80% 85%)`,
      onSolid: `hsl(${h} 60% 12%)`,
      ring: `hsl(${h} 46% 42% / 0.6)`,
    };
  }
  return {
    solid: `hsl(${h} 72% ${46 + step * 3}%)`,
    soft: `hsl(${h} 82% ${88 + step}%)`,
    onSoft: `hsl(${h} 65% 26%)`,
    onSolid: `hsl(${h} 60% 14%)`,
    ring: `hsl(${h} 65% 80%)`,
  };
}
