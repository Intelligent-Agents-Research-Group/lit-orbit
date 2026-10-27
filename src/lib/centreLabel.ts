/**
 * How the course name is written in the circle at the centre of the orbit.
 *
 * The name is broken into lines between its words, and the circle grows to
 * hold them rather than the words being squeezed to fit: a name condensed to
 * three quarters of its width reads as crowded however short it is. Where
 * the lines break depends on the name alone, never on the size of the
 * window, so resizing scales the circle and the text but never moves a break.
 */

/** Width of a piece of text at the full font size, px. */
export type MeasureText = (text: string) => number;

export interface CentreRoom {
  /** Radius of the centre circle before it grows, px. */
  radius: number;
  /** The most the circle may grow to, px; past that the text shrinks instead. */
  maxRadius: number;
  /** Font size the name is written at, px. */
  fontSize: number;
  /** The smallest the text shrinks to, px; past that it is condensed. */
  minFontSize: number;
}

export interface CentreLine {
  text: string;
  /** Middle of the line, px below the centre of the circle (negative is above). */
  y: number;
  /** Room across the circle at this line, px; wider text is condensed into it. */
  maxWidth: number;
}

export interface CentreLabelLayout {
  lines: CentreLine[];
  /** Radius of the centre circle, px. */
  radius: number;
  /** Font size, px. */
  fontSize: number;
}

export const CENTRE_LABEL_MAX_LINES = 3;
/** Distance between the middles of two lines, in ems. */
const LINE_HEIGHT = 1.15;
/** How far a line of capitals reaches above and below its middle, in ems. */
const HALF_LINE = 0.36;
/** Clear space kept between the name and the edge of the circle, px. */
const PADDING = 6;
/**
 * A layout with more lines is only taken when it needs this share or less of
 * the room of the best with fewer: a word broken off on a line of its own
 * reads worse than a circle a little larger.
 */
const MORE_LINES_GAIN = 0.75;

interface Candidate {
  lines: string[];
  /** Radius the lines need, in ems, before the padding. */
  reach: number;
}

export function layoutCentreLabel(label: string, measure: MeasureText, room: CentreRoom): CentreLabelLayout {
  const words = label.split(/\s+/).filter(Boolean);
  const widths = new Map<string, number>();
  const emWidth = (text: string) => {
    let width = widths.get(text);
    if (width === undefined) {
      width = measure(text) / room.fontSize;
      widths.set(text, width);
    }
    return width;
  };

  let best: Candidate | null = null;
  for (let count = 1; count <= Math.min(CENTRE_LABEL_MAX_LINES, words.length); count += 1) {
    let narrowest: Candidate | null = null;
    for (const lines of splits(words, count)) {
      const reach = lineReach(lines.map(emWidth));
      if (!narrowest || reach < narrowest.reach) narrowest = { lines, reach };
    }
    if (narrowest && (!best || narrowest.reach <= best.reach * MORE_LINES_GAIN)) best = narrowest;
  }
  if (!best) return { lines: [], radius: room.radius, fontSize: room.fontSize };

  const needed = PADDING + best.reach * room.fontSize;
  const radius = Math.min(room.maxRadius, Math.max(room.radius, needed));
  const fontSize =
    needed <= room.maxRadius ? room.fontSize : Math.max(room.minFontSize, (room.maxRadius - PADDING) / best.reach);
  const inner = Math.max(0, radius - PADDING);
  const count = best.lines.length;
  return {
    radius,
    fontSize,
    lines: best.lines.map((text, index) => {
      const y = lineOffset(index, count) * fontSize;
      const edge = Math.min(inner, Math.abs(y) + HALF_LINE * fontSize);
      return { text, y, maxWidth: 2 * Math.sqrt(inner * inner - edge * edge) };
    }),
  };
}

/** Middle of a line, in ems below the middle of the block. */
function lineOffset(index: number, count: number): number {
  return (index - (count - 1) / 2) * LINE_HEIGHT;
}

/** Radius, in ems, of the smallest circle about the middle that holds lines of these widths. */
function lineReach(widths: number[]): number {
  return Math.max(
    ...widths.map((width, index) => Math.hypot(width / 2, Math.abs(lineOffset(index, widths.length)) + HALF_LINE)),
  );
}

/** Every way of breaking the words into `count` lines, keeping their order. */
function splits(words: string[], count: number): string[][] {
  if (count === 1) return [[words.join(' ')]];
  const result: string[][] = [];
  for (let end = 1; end <= words.length - count + 1; end += 1) {
    const first = words.slice(0, end).join(' ');
    for (const rest of splits(words.slice(end), count - 1)) result.push([first, ...rest]);
  }
  return result;
}
