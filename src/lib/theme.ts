import { CATEGORY_COLOUR_TOKENS, CATEGORY_OVERFLOW_TOKEN } from '../config/defaults';

/**
 * Colours and fonts the canvas needs, resolved from the CSS tokens in
 * src/styles/tokens.css. Canvas 2D cannot read `var(--x)` itself, so we read
 * the computed values once and hand them to the renderer.
 */
export interface OrbitTheme {
  bg: string;
  ringLine: string;
  ringLineStrong: string;
  ringLabel: string;
  wedgeLine: string;
  wedgeLabel: string;
  centreFill: string;
  centreText: string;
  dotOutline: string;
  dotHalo: string;
  /** Alpha of a study that misses one filter (`OrbitNode.nearMiss`). */
  dotNearMissAlpha: number;
  /** Glow around a hovered dot: blur radius in px, and how strongly it paints. */
  dotGlowBlur: number;
  dotGlowAlpha: number;
  fontSans: string;
  textXs: string;
  textSm: string;
  /** Palette for the "colour by" column, in order. */
  categoryColours: string[];
  categoryOverflow: string;
}

export function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readNumber(name: string, fallback: number): number {
  const parsed = Number.parseFloat(readToken(name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readOrbitTheme(): OrbitTheme {
  return {
    bg: readToken('--orbit-bg'),
    ringLine: readToken('--orbit-ring-line'),
    ringLineStrong: readToken('--orbit-ring-line-strong'),
    ringLabel: readToken('--orbit-ring-label'),
    wedgeLine: readToken('--orbit-wedge-line'),
    wedgeLabel: readToken('--orbit-wedge-label'),
    centreFill: readToken('--orbit-centre-fill'),
    centreText: readToken('--orbit-centre-text'),
    dotOutline: readToken('--orbit-dot-outline'),
    dotHalo: readToken('--orbit-dot-halo'),
    dotNearMissAlpha: readNumber('--orbit-dot-near-miss-alpha', 0.5),
    dotGlowBlur: readNumber('--orbit-dot-glow-blur', 10),
    dotGlowAlpha: readNumber('--orbit-dot-glow-alpha', 0.9),
    fontSans: readToken('--font-sans'),
    textXs: readToken('--text-xs'),
    textSm: readToken('--text-sm'),
    categoryColours: CATEGORY_COLOUR_TOKENS.map((token) => readToken(token)),
    categoryOverflow: readToken(CATEGORY_OVERFLOW_TOKEN),
  };
}

/** Colour for the n-th category; categories beyond the palette share the overflow colour. */
export function categoryColour(theme: OrbitTheme, index: number): string {
  return theme.categoryColours[index] ?? theme.categoryOverflow;
}

/** CSS `var()` expression for the n-th category, for use in React-rendered legends and lists. */
export function categoryColourVar(index: number): string {
  const token = CATEGORY_COLOUR_TOKENS[index] ?? CATEGORY_OVERFLOW_TOKEN;
  return `var(${token})`;
}
