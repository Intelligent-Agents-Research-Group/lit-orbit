/** Collapse every run of whitespace to one space and trim the ends. */
export function tidySpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Excel and Notepad write a byte-order mark at the start of a UTF-8 file; drop it. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Digits inside a string, kept as their own chunk so they compare as numbers. */
const NUMBER_CHUNK = /(\d+(?:\.\d+)?)/;

/**
 * Order values the way a reader expects: digits inside them compare as
 * numbers, not as text. Without it "10-21" sorts after "100-110", and the
 * bands of a grouped numeric column come out shuffled.
 */
export function compareValues(a: string, b: string): number {
  const left = a.split(NUMBER_CHUNK);
  const right = b.split(NUMBER_CHUNK);
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const one = left[index];
    const other = right[index];
    // Chunks alternate text, number, text, ... so both sides line up.
    const numeric = index % 2 === 1;
    const order = numeric ? Number(one) - Number(other) : one.localeCompare(other);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

/**
 * Order the values of a numeric column: the numbers first and in order, then
 * whatever the column writes in place of a number ("Not Reported"). Those are
 * not points on the scale, and letting a digit inside one sort it between 40
 * and 50 would say that they were.
 */
export function compareNumericValues(a: string, b: string): number {
  const left = Number(a);
  const right = Number(b);
  const leftIsNumber = a.trim() !== '' && Number.isFinite(left);
  const rightIsNumber = b.trim() !== '' && Number.isFinite(right);
  if (leftIsNumber && rightIsNumber) return left - right;
  if (leftIsNumber !== rightIsNumber) return leftIsNumber ? -1 : 1;
  return compareValues(a, b);
}

/**
 * "Screening batch (v2)" -> "screening-batch-v2": text made safe to be part of
 * a file name. Empty when nothing in it survives, so the caller picks a name.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "course_level" -> "course level": column keys shown as labels. */
export function prettyKey(key: string): string {
  return key.replace(/[_-]+/g, ' ').trim();
}

/**
 * Shorten `text` until it measures no wider than `maxWidth`, ending it in an
 * ellipsis. Canvas takes a max width of its own, but it *condenses* the
 * glyphs to fit rather than cutting the text, which turns a long category
 * name into an unreadable smear; this cuts instead.
 *
 * Measuring is passed in because how wide text is depends on the font of the
 * canvas it will be drawn on, which this file knows nothing about.
 */
export function fitToWidth(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (maxWidth <= 0) return '';
  if (measure(text) <= maxWidth) return text;
  // Binary search for the longest prefix that still fits with the ellipsis.
  let fits = 0;
  let tooWide = text.length;
  while (fits < tooWide) {
    const middle = Math.ceil((fits + tooWide) / 2);
    if (measure(withEllipsis(text, middle)) <= maxWidth) fits = middle;
    else tooWide = middle - 1;
  }
  return withEllipsis(text, fits);
}

function withEllipsis(text: string, length: number): string {
  return text.slice(0, length).trimEnd() + '…';
}
