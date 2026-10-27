import {
  BAND_COUNT_CHOICES,
  BAND_EDGES,
  BAND_MIN_DISTINCT,
  DELIMITER_MAX_PART_LENGTH,
  DELIMITER_MIN_SHARE,
  DELIMITER_OFFER_MIN_SHARE,
  MULTI_VALUE_DELIMITERS,
  PREFIX_SEPARATORS,
} from '../config/defaults';
import type { CellValue, ColumnRule, ColumnRules, Dataset, PrefixSeparator, Row } from '../data/model';
import { tidySpaces } from './text';

/** One value per cell, taken as written. */
export const WHOLE: ColumnRule = { split: null, prefix: null, bands: null };

/**
 * The rules a known spreadsheet is most often read with, named once for the
 * setups that spell them out (`data/example.ts`, `data/reconciled.ts`).
 */
/** "Yes - and here is how": only the first words are the answer. */
export const CUT_AT_DASH: ColumnRule = { ...WHOLE, prefix: 'dash' };
/** Several answers in one cell, one per line. */
export const ONE_PER_LINE: ColumnRule = { ...WHOLE, split: '\n' };
/** "Introductory and Intermediate": two values, not a third. */
export const SPLIT_ON_AND: ColumnRule = { ...WHOLE, split: ' and ' };

// ---- Applying a rule --------------------------------------------------------

/** Read one column's cells under `rule`. */
export function applyRule(cells: CellValue[], rule: ColumnRule): CellValue[] {
  let read = cells;
  if (rule.bands !== null) {
    read = rule.bandEdges === 'equalCount' ? bandByCount(read, rule.bands) : bandByWidth(read, rule.bands);
  }
  if (rule.split !== null) read = read.map((cell) => splitCell(cell, rule.split as string));
  if (rule.prefix !== null) read = read.map((cell) => cutCell(cell, rule.prefix as PrefixSeparator));
  return read;
}

function splitCell(cell: CellValue, delimiter: string): CellValue {
  if (typeof cell !== 'string') return cell;
  const parts = cell.split(delimiter).map(tidySpaces).filter(Boolean);
  return parts.length === 0 ? null : parts.length === 1 ? parts[0] : parts;
}

function cutCell(cell: CellValue, separator: PrefixSeparator): CellValue {
  if (typeof cell === 'string') return cut(cell, separator);
  if (Array.isArray(cell)) {
    const parts = cell.map((part) => cut(part, separator)).filter(Boolean);
    return parts.length === 0 ? null : parts.length === 1 ? parts[0] : parts;
  }
  return cell;
}

function cut(text: string, separator: PrefixSeparator): string {
  const pattern = PREFIX_SEPARATORS.find((candidate) => candidate.id === separator)?.pattern;
  if (!pattern) return text;
  const hit = pattern.exec(text);
  return tidySpaces(hit ? text.slice(0, hit.index) : text);
}

/**
 * Replace every number with the equal stretch of the scale it falls into,
 * written as the stretch's two ends. Cells that are not numbers ("Not
 * Reported") are left alone: they are an answer of their own, not a value
 * that belongs somewhere on the scale.
 */
function bandByWidth(cells: CellValue[], count: number): CellValue[] {
  const numbers = cells.filter((cell): cell is number => typeof cell === 'number');
  if (numbers.length === 0 || count < 1) return cells;
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  if (min === max) return cells.map((cell) => (typeof cell === 'number' ? bandLabel(min, max) : cell));
  const width = (max - min) / count;
  return cells.map((cell) => {
    if (typeof cell !== 'number') return cell;
    // The top of the range would land one band too far, so it is clamped in.
    const index = Math.min(count - 1, Math.floor((cell - min) / width));
    return bandLabel(min + index * width, min + (index + 1) * width);
  });
}

/**
 * Replace every number with a band cut so that each holds about as many
 * cells, written as the lowest and the highest number actually in it. The
 * ends are numbers the column holds, so no band claims a stretch of the
 * scale no study sits in. Equal numbers always share a band: a column heavy
 * with one value comes out with fewer bands than asked for rather than with
 * that value cut in two.
 */
function bandByCount(cells: CellValue[], count: number): CellValue[] {
  const numbers = cells.filter((cell): cell is number => typeof cell === 'number').sort((a, b) => a - b);
  if (numbers.length === 0 || count < 1) return cells;
  const bandOf = new Map<number, number>();
  let start = 0;
  while (start < numbers.length) {
    let end = start;
    while (end < numbers.length && numbers[end] === numbers[start]) end += 1;
    // A run of equal numbers is placed by the rank at its middle, so it lands
    // in the band most of it would have fallen into.
    const middle = (start + end) / 2;
    bandOf.set(numbers[start], Math.min(count - 1, Math.floor((middle * count) / numbers.length)));
    start = end;
  }
  // Numbers went in from the lowest, so each band's first one is its low end.
  const ends = new Map<number, [number, number]>();
  for (const [value, band] of bandOf) ends.set(band, [ends.get(band)?.[0] ?? value, value]);
  return cells.map((cell) => {
    if (typeof cell !== 'number') return cell;
    const [low, high] = ends.get(bandOf.get(cell) as number) as [number, number];
    return round(low) === round(high) ? round(low) : bandLabel(low, high);
  });
}

function bandLabel(low: number, high: number): string {
  return round(low) + '–' + round(high);
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// ---- Choosing a rule --------------------------------------------------------

/**
 * Decide whether a column holds lists, and on which character they are split.
 *
 * The delimiter has to be common in the column, has to leave short parts, and
 * has to produce a vocabulary that repeats across rows. Without that last
 * test a title column would be shredded by the semicolons inside titles.
 */
export function detectDelimiter(cells: CellValue[]): string | null {
  const texts = cells.filter((cell): cell is string => typeof cell === 'string');
  if (texts.length === 0) return null;
  return MULTI_VALUE_DELIMITERS.find((delimiter) => readsAsLists(texts, delimiter)) ?? null;
}

/**
 * Whether these cells read as lists on `delimiter`: it is common enough in
 * the column to be its habit, and the parts it leaves repeat across rows. The
 * file check asks the same of characters the column is never split on, so it
 * can say when a column holds lists the app will read as one value each.
 */
export function readsAsLists(texts: string[], delimiter: string): boolean {
  const holders = texts.filter((text) => text.includes(delimiter));
  if (holders.length < texts.length * DELIMITER_MIN_SHARE) return false;
  const parts = splitParts(holders, delimiter);
  if (parts.length < holders.length * 2) return false;
  const distinct = new Set(parts.map((part) => part.toLowerCase()));
  if (holders.length >= 5 && distinct.size > parts.length * 0.8) return false;
  return splitFactors(texts, delimiter);
}

/**
 * Whether `delimiter` sits *between* values in these cells rather than inside
 * them: the parts it leaves are short, are not all digits, and are fewer
 * distinct values than the cells were whole.
 *
 * All-numeric parts mean the character is punctuation inside one value, as in
 * a date written 2024/01/15 or a number written 1,200. And splitting has to
 * *factor* the column: a delimiter that leaves the column with more distinct
 * values than it started with sits inside them rather than between them, as
 * the comma does in the four study designs of "2+ Conditions, Random
 * Assignment".
 */
export function splitFactors(texts: string[], delimiter: string): boolean {
  const holders = texts.filter((text) => text.includes(delimiter));
  if (holders.length === 0) return false;
  const parts = splitParts(holders, delimiter);
  if (parts.some((part) => part.length > DELIMITER_MAX_PART_LENGTH)) return false;
  if (parts.every((part) => /^\d+$/.test(part))) return false;
  return vocabularyUnder(texts, { ...WHOLE, split: delimiter }) < new Set(texts.map(folded)).size;
}

/** Every value the cells would hold, split on `delimiter` and tidied. */
function splitParts(holders: string[], delimiter: string): string[] {
  return holders
    .flatMap((text) => text.split(delimiter))
    .map(tidySpaces)
    .filter(Boolean);
}

/** Lower-cased and tidied, so two spellings of one value count once. */
function folded(text: string): string {
  return tidySpaces(text).toLowerCase();
}

/** How many distinct values the column would hold when read under `rule`. */
function vocabularyUnder(texts: string[], rule: ColumnRule): number {
  const read = applyRule(texts, rule).flatMap((cell) => (Array.isArray(cell) ? cell : [cell]));
  return new Set(read.filter((value): value is string => typeof value === 'string').map(folded)).size;
}

/**
 * The rule a freshly loaded column starts on. Only splitting is guessed:
 * cutting a column short and grouping numbers both throw information away, so
 * they are offered in *Column rules* rather than applied behind the user's
 * back.
 */
export function detectRule(cells: CellValue[]): ColumnRule {
  const delimiter = detectDelimiter(cells);
  return delimiter === null ? WHOLE : { ...WHOLE, split: delimiter };
}

export function detectRules(rows: Row[], keys: string[]): ColumnRules {
  return Object.fromEntries(keys.map((key) => [key, detectRule(rows.map((row) => row[key]))]));
}

// ---- Offering a rule to the user -------------------------------------------

/**
 * The rules worth offering for one column: only the ones that would change
 * it. A separator the column never uses, or a split that leaves every cell as
 * it was, is noise in the dropdown rather than a choice - unless the
 * separator is common in the column (`DELIMITER_OFFER_MIN_SHARE`), when it is
 * offered whatever splitting on it does.
 */
export function ruleOptions(cells: CellValue[]): ColumnRule[] {
  const texts = cells.filter((cell): cell is string => typeof cell === 'string');
  const whole = new Set(texts.map(folded)).size;
  const splits: (string | null)[] = [null];
  const common = new Set<string>();
  for (const delimiter of MULTI_VALUE_DELIMITERS) {
    const holders = texts.filter((text) => text.includes(delimiter)).length;
    if (holders === 0) continue;
    splits.push(delimiter);
    if (holders >= texts.length * DELIMITER_OFFER_MIN_SHARE) common.add(delimiter);
  }
  const prefixes: (PrefixSeparator | null)[] = [null];
  for (const separator of PREFIX_SEPARATORS) {
    if (texts.some((text) => separator.pattern.test(text))) prefixes.push(separator.id);
  }

  const options: ColumnRule[] = [];
  for (const split of splits) {
    for (const prefix of prefixes) {
      const rule: ColumnRule = { split, prefix, bands: null };
      // Offering is a lower bar than detecting: a delimiter one cell in a
      // hundred uses is still worth offering, where guessing it would be
      // reckless. What a split still has to do is factor the column - the
      // last guard in `detectDelimiter` says why - and it is weighed
      // together with the cut, because the two are one choice to the person
      // making it. A column written one answer per line, each of them
      // "Other - and here is what else was measured", only factors once the
      // explanation is cut off: splitting it alone leaves more values than
      // the column started with, so weighing that step on its own kept the
      // pair out of the dropdown entirely.
      //
      // A separator common in the column skips the test: it is offered as a
      // candidate for the user to try, not a reading the reader vouches for.
      if (split !== null && !common.has(split) && vocabularyUnder(texts, rule) >= whole) continue;
      options.push(rule);
    }
  }
  const numbers = new Set(cells.filter((cell): cell is number => typeof cell === 'number'));
  if (numbers.size >= BAND_MIN_DISTINCT) {
    for (const bandEdges of BAND_EDGES) {
      for (const bands of BAND_COUNT_CHOICES) options.push({ ...WHOLE, bands, bandEdges });
    }
  }
  return options;
}

/** Every column of a batch with the rules it could be read under, in file order. */
export interface ColumnRuleChoice {
  key: string;
  options: ColumnRule[];
}

export function columnRuleChoices(dataset: Dataset): ColumnRuleChoice[] {
  return dataset.columns.map((column) => ({
    key: column.key,
    options: ruleOptions(dataset.rows.map((row) => row[column.key])),
  }));
}

/**
 * A rule as one string, so it can be the value of a <select>. Options are
 * looked up by this key rather than parsed back, so the encoding only has to
 * tell two rules apart.
 */
export function ruleKey(rule: ColumnRule): string {
  // A rule with no edges named cuts at equal width, so it is the same rule as
  // one that names them, and has to land on the same option.
  const edges = rule.bands === null ? '' : (rule.bandEdges ?? 'equalWidth');
  return [rule.split ?? '', rule.prefix ?? '', rule.bands ?? '', edges].join('');
}

const DELIMITER_NAMES: Record<string, string> = {
  ';': 'a semicolon',
  '|': 'a pipe',
  '\n': 'a line break',
  '、': 'an ideographic comma',
  '/': 'a slash',
  ',': 'a comma',
  ' and ': 'the word "and"',
  ' + ': 'a plus sign',
  ' & ': 'an ampersand',
  ' or ': 'the word "or"',
  '•': 'a bullet',
};

/** A delimiter said in words, so a line break is not shown as a line break. */
export function delimiterName(delimiter: string): string {
  return DELIMITER_NAMES[delimiter] ?? `"${delimiter}"`;
}

export function ruleLabel(rule: ColumnRule): string {
  if (rule.bands !== null) {
    const edges = rule.bandEdges === 'equalCount' ? 'equal-count' : 'equal-width';
    return `Numbers grouped into ${rule.bands} ${edges} bands`;
  }
  const head = rule.split === null ? 'One value per cell' : `Several values, split on ${delimiterName(rule.split)}`;
  if (rule.prefix === null) return head;
  const name = PREFIX_SEPARATORS.find((candidate) => candidate.id === rule.prefix)?.name ?? rule.prefix;
  return `${head}, cut at ${name}`;
}
