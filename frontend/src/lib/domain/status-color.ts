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
 * MONOCHROME BRAND SYSTEM — the entire app is drawn in black, white, and ONE
 * hue: warm orange. Every color generator below ignores the *actual* hue it's
 * given for the H channel and instead emits a shade of BRAND_H, using the stored
 * hue only to pick a deterministic lightness step so distinct statuses / tags /
 * avatars still read as different ORANGE shades rather than all-identical.
 */
const BRAND_H = 18;

/** Stored hue (0..360) → a small deterministic shade step (0..4). */
function shadeStep(hue: number): number {
  const h = ((hue % 360) + 360) % 360;
  return Math.floor(h / 72) % 5;
}

/** Swatch values kept as-is; they now map to five orange shades via shadeStep. */
export const STATUS_HUES = [211, 262, 291, 330, 0, 24, 45, 142, 168, 199] as const;

/** Chart/meter series — cycled through statusColors(), so each series is a
 *  distinct shade of the single brand orange. */
export const DATAVIZ_HUES = [0, 72, 144, 216] as const;

/**
 * Orange accent set for the list header rail/dot/wash — a shade of the single
 * brand hue, varied slightly per stored hue.
 */
export function softAccent(hue: number) {
  const step = shadeStep(hue);
  return {
    line: `hsl(${BRAND_H} 80% ${50 + step * 2}%)`,
    dot: `hsl(${BRAND_H} 74% ${54 + step * 2}%)`,
    wash: `hsl(${BRAND_H} 60% 40% / 0.14)`,
    chipBg: `hsl(${BRAND_H} 40% 30% / 0.5)`,
    chipText: `hsl(${BRAND_H} 72% 78%)`,
  };
}

/**
 * Solid ORANGE task-card palette, keyed by priority INTENSITY (level 0 = boldest
 * → 3 = palest), not by hue — so the board reads as shades of the one brand
 * orange. Fully opaque, no alpha. Used on both boards.
 */
export function vividCard(level: number) {
  const l = Math.max(0, Math.min(3, Math.round(level)));
  const bgL = [80, 84, 88, 92][l];
  const bgS = [94, 92, 90, 86][l];
  return {
    bg: `hsl(${BRAND_H} ${bgS}% ${bgL}%)`,
    border: `hsl(${BRAND_H} 74% ${bgL - 10}%)`,
    rail: `hsl(${BRAND_H} 82% 52%)`,
    title: `hsl(${BRAND_H} 44% 26%)`,
    meta: `hsl(${BRAND_H} 30% 40%)`,
    chipBg: `hsl(${BRAND_H} 82% ${bgL - 5}%)`,
    chipText: `hsl(${BRAND_H} 48% 30%)`,
    /** Same hue, a few shades darker — for dividers on the card. */
    divider: `hsl(${BRAND_H} 62% ${bgL - 12}%)`,
  };
}

export function statusColors(hue: number, theme: 'light' | 'dark' = 'light'): StatusColors {
  // Single brand hue; the stored hue only picks a shade step so distinct
  // statuses/tags stay distinguishable as different oranges.
  const step = shadeStep(hue);
  if (theme === 'dark') {
    return {
      solid: `hsl(${BRAND_H} 85% ${54 + step * 3}%)`,
      soft: `hsl(${BRAND_H} 46% ${26 + step * 2}%)`,
      onSoft: `hsl(${BRAND_H} 85% 86%)`,
      onSolid: `hsl(${BRAND_H} 45% 12%)`,
      ring: `hsl(${BRAND_H} 46% 42% / 0.6)`,
    };
  }
  return {
    solid: `hsl(${BRAND_H} 82% ${46 + step * 3}%)`,
    soft: `hsl(${BRAND_H} 85% ${88 + step}%)`,
    onSoft: `hsl(${BRAND_H} 68% 32%)`,
    onSolid: `hsl(0 0% 100%)`,
    ring: `hsl(${BRAND_H} 65% 82%)`,
  };
}
