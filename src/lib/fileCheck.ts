import {
  COLOUR_MAX_CATEGORIES,
  COLUMN_NAME_MAX_LENGTH,
  DELIMITER_MAX_PART_LENGTH,
  MANY_VALUES_MAX_RATIO,
  MIXED_DELIMITER_MIN_SHARE,
  MULTI_VALUE_DELIMITERS,
  NOTE_ROW_MIN_COLUMNS,
  NUMBERS_IN_TEXT_MIN_SHARE,
  UNSPLIT_DELIMITERS,
} from '../config/defaults';
import { cellValues, findColumn, type CellValue, type ColumnInfo, type Dataset } from '../data/model';
import { delimiterName, readsAsLists, splitFactors } from './columnRules';
import { filterMaxCategories } from './dataset';
import type { ImportReading } from './importInfo';
import { tidySpaces } from './text';

/**
 * A look over a freshly read batch for the shapes the reader handles badly.
 *
 * The reader makes do with whatever table it is given - a column mixing two
 * separators is split on one of them, a note under the table becomes a study
 * with one cell - and nothing on screen says so. These checks say so, next to
 * the file, while the file is still the easy thing to change. Every one of
 * them is a guess from the cells, so each is worded as what was seen rather
 * than as a verdict, and carries the fix an AI would be asked for.
 */

export type FileWarningKind =
  | 'no-header'
  | 'unnamed-columns'
  | 'repeated-names'
  | 'long-names'
  | 'one-column'
  | 'note-rows'
  | 'mixed-delimiters'
  | 'unsplit-delimiter'
  | 'second-delimiter'
  | 'many-values'
  | 'numbers-in-text'
  | 'nested-values';

export interface FileWarning {
  kind: FileWarningKind;
  /** The columns it is about, named as the batch names them; none for a warning about the table as a whole. */
  columns: string[];
  /** What was seen. Read after the column names when there are any, so it starts with a verb. */
  message: string;
  /** What to ask for instead: the line the instruction for an AI carries, unless it asks the user instead. */
  fix: string;
  /** Columns only the user can name, by the name Lit Orbit gave them: the instruction has the AI ask. */
  names?: string[];
  /** The separators the column uses between values, main one first: the instruction has the AI ask what each does. */
  separators?: string[];
}

/** A warning only the user can settle, so the instruction for an AI has it ask them. */
export function asksTheUser(warning: FileWarning): boolean {
  return (warning.names?.length ?? 0) > 0 || (warning.separators !== undefined && warning.columns.length === 1);
}

/**
 * The checks, over the batch as the file wrote it (`batch`), the same batch
 * as it is read under the column rules in force (`dataset`), and how the file
 * was read. Most look at the cells as written; the one about a column's
 * vocabulary looks at what the rules leave, so it follows a rule as it is
 * changed.
 */
export function checkBatch(batch: Dataset, dataset: Dataset, reading: ImportReading | null): FileWarning[] {
  const warnings: FileWarning[] = [];
  const noHeader = reading !== null && reading.grid && reading.headerRow === 0;
  if (noHeader) {
    warnings.push({
      kind: 'no-header',
      columns: [],
      message:
        'No line of column names was found, so the columns are called Column 1, Column 2 and so on. If the file has one, choose its line above.',
      fix: 'Put the column names on the first line of the table, one short name per column.',
      names: batch.columns.map((column) => column.key),
    });
  }

  if (batch.columns.length === 1 && batch.rows.length > 1) {
    warnings.push({
      kind: 'one-column',
      columns: [],
      message: 'Only one column was found. If the file has more, the character between them was not recognised.',
      fix: 'Save the table as a CSV with commas between the columns, or as an XLSX workbook.',
    });
  }

  const keys = batch.columns.map((column) => column.key);
  const unnamed = noHeader ? [] : keys.filter((key) => /^Column \d+$/.test(key));
  if (unnamed.length > 0) {
    warnings.push({
      kind: 'unnamed-columns',
      columns: unnamed,
      message: `${plural(unnamed.length, 'has', 'have')} no name in the file, so ${plural(unnamed.length, 'it is', 'they are')} called by position.`,
      fix: 'Give every column a short name on the header line, after what its cells hold.',
      names: unnamed,
    });
  }

  const repeated = keys.filter((key) => {
    const base = /^(.+) \(\d+\)$/.exec(key)?.[1];
    return base !== undefined && keys.includes(base);
  });
  if (repeated.length > 0) {
    warnings.push({
      kind: 'repeated-names',
      columns: repeated,
      message: `${plural(repeated.length, 'is', 'are')} named the same as another column, so the copies were numbered.`,
      fix: 'Name every column differently, or drop the copy.',
    });
  }

  const long = keys.filter((key) => key.length > COLUMN_NAME_MAX_LENGTH);
  if (long.length > 0) {
    warnings.push({
      kind: 'long-names',
      columns: long,
      message: `${plural(long.length, 'has', 'have')} a name over ${COLUMN_NAME_MAX_LENGTH} characters long, which is what a line of data looks like: check the header row.`,
      fix: 'Put the column names on the header line, and keep each to a word or two.',
    });
  }

  if (batch.columns.length >= NOTE_ROW_MIN_COLUMNS) {
    const notes = batch.rows.filter((row) => keys.filter((key) => row[key] !== null).length <= 1).length;
    if (notes > 0) {
      warnings.push({
        kind: 'note-rows',
        columns: [],
        message: `${notes} ${plural(notes, 'row holds', 'rows hold')} a single cell, which looks like a note, a heading or a total rather than a study.`,
        fix: 'Keep one row per study in the table; move notes, headings and totals to another sheet or file.',
      });
    }
  }

  for (const column of batch.columns) {
    const cells = batch.rows.map((row) => row[column.key]);
    const texts = cells.filter((cell): cell is string => typeof cell === 'string');
    const mixed = mixedDelimiters(texts);
    const unsplit = mixed ? undefined : UNSPLIT_DELIMITERS.find((delimiter) => readsAsLists(texts, delimiter));
    if (mixed) {
      warnings.push({
        kind: 'mixed-delimiters',
        columns: [column.key],
        message: `uses both ${delimiterName(mixed[0])} and ${delimiterName(mixed[1])} between values; a column is split on one character only.`,
        fix: 'Separate the values in this column with a semicolon throughout.',
        separators: mixed,
      });
    } else if (unsplit !== undefined) {
      warnings.push({
        kind: 'unsplit-delimiter',
        columns: [column.key],
        message: `looks like several values separated by ${delimiterName(unsplit)}, which the app does not split on.`,
        fix: 'Separate the values in this column with a semicolon instead.',
      });
    } else {
      // A column whose separators are wrong yields too many values for that
      // reason alone, which the point above already makes.
      const list = listReading(batch, dataset, column.key);
      if (list) {
        const warning = listWarning(list);
        if (warning) warnings.push({ ...warning, columns: [column.key] });
      } else {
        const many = manyValues(dataset, column.key);
        if (many) {
          warnings.push({
            kind: 'many-values',
            columns: [column.key],
            message: `yields ${many.distinct} distinct values from ${many.filled} cells: too many to filter or colour by, yet some of them repeat, as if one thing were written several ways or the categories were finer than needed.`,
            fix: mergeFix(many.limit),
          });
        }
      }
    }
    const wordy = numbersInText(column, texts);
    if (wordy !== null) {
      warnings.push({
        kind: 'numbers-in-text',
        columns: [column.key],
        message: `looks like numbers written inside text ("${wordy}"), so it cannot size the dots or be grouped into bands.`,
        fix: 'Write the numbers in this column as plain numbers, with units and remarks in a column of their own.',
      });
    }
    if (cells.some(isFlattenedObject)) {
      warnings.push({
        kind: 'nested-values',
        columns: [column.key],
        message: 'holds nested objects, which were read as "[object Object]".',
        fix: 'Flatten nested objects into columns of their own, with plain text or a number in each.',
      });
    }
  }
  return warnings;
}

/** The warnings about one column, for showing beside its rule. */
export function columnWarnings(warnings: FileWarning[], key: string): FileWarning[] {
  return warnings.filter((warning) => warning.columns.includes(key));
}

/**
 * Two characters that each sit between values in this column, and are each
 * used without the other in enough cells to be two habits rather than one
 * inside the other. Earlier delimiters in `MULTI_VALUE_DELIMITERS` are the
 * ones the reader prefers, so the pair comes out in that order.
 */
function mixedDelimiters(texts: string[]): [string, string] | null {
  // Each character is judged on the cells that use it: in a column written two
  // ways, the cells written the other way would count against it otherwise.
  const between = MULTI_VALUE_DELIMITERS.filter((delimiter) =>
    splitFactors(
      texts.filter((text) => text.includes(delimiter)),
      delimiter,
    ),
  );
  for (let first = 0; first < between.length; first += 1) {
    for (let second = first + 1; second < between.length; second += 1) {
      const a = between[first];
      const b = between[second];
      const onlyA = texts.filter((text) => text.includes(a) && !text.includes(b)).length;
      const onlyB = texts.filter((text) => text.includes(b) && !text.includes(a)).length;
      const either = texts.filter((text) => text.includes(a) || text.includes(b)).length;
      const floor = Math.max(2, Math.ceil(either * MIXED_DELIMITER_MIN_SHARE));
      if (onlyA >= floor && onlyB >= floor) return [a, b];
    }
  }
  return null;
}

/**
 * A column whose values are separated by one character or two, and what
 * splitting on them comes to.
 */
interface ListReading {
  /** The separators that sit between values, main one first: one, or two. */
  separators: string[];
  /** The rules split the column on the main separator; false when it is read one value per cell. */
  split: boolean;
  /** Distinct values the cells hold whole. */
  whole: number;
  /** Distinct values left after splitting on every separator in `separators`. */
  distinct: number;
  limit: number;
  /** A cell, or a piece of one, holding the second separator, to quote. */
  example: string | null;
}

/**
 * Whether the column's values are separated by a character - or two - and
 * what splitting on them leaves. A separator counts when splitting on it
 * lowers the count of distinct values: then it sits between values rather
 * than inside them, the test `columnRules.splitFactors` puts to a split.
 *
 * The separator is looked for in three places, in turn: the one the rules
 * split the column on; for a column read one value per cell, any one that
 * lowers the count on its own; and failing that, any two that lower it only
 * together. That last is the plainest sign of a column written with two
 * separators - "A, B; C, D" in every row - whose pieces, split on either one
 * alone, are more varied than the cells were, so the reader splits on
 * neither. With one separator found, the pieces it leaves are searched for a
 * second.
 *
 * `null` when no separator lowers the count: the column is then judged as a
 * column of single values.
 */
function listReading(batch: Dataset, dataset: Dataset, key: string): ListReading | null {
  const column = findColumn(dataset, key);
  if (column === undefined || column.numeric) return null;
  const texts = batch.rows.map((row) => row[key]).filter((cell): cell is string => typeof cell === 'string');
  const whole = distinctFolded(texts);
  const limit = filterMaxCategories(dataset.rows.length);
  const ruled = dataset.rules[key]?.split ?? null;

  let main: string | undefined;
  let pieces: string[] = [];
  if (ruled !== null) {
    // The rule is what the column is read under, so it is the one judged.
    pieces = dataset.rows.flatMap((row) => cellValues(row, key));
    if (distinctFolded(pieces) >= whole) return null;
    main = ruled;
  } else {
    main = MULTI_VALUE_DELIMITERS.find((candidate) => lowers(texts, [candidate], whole));
    if (main !== undefined) pieces = splitAll(texts, [main]);
  }

  if (main !== undefined) {
    const inside = distinctFolded(pieces);
    const second = SECOND_CANDIDATES.find((candidate) => candidate !== main && lowers(pieces, [candidate], inside));
    const separators = second === undefined ? [main] : [main, second];
    return {
      separators,
      split: ruled !== null,
      whole,
      distinct: distinctFolded(splitAll(pieces, separators.slice(1))),
      limit,
      example: second === undefined ? null : (pieces.find((piece) => piece.includes(second)) ?? null),
    };
  }

  for (const [index, first] of MULTI_VALUE_DELIMITERS.entries()) {
    for (const second of SECOND_CANDIDATES.slice(index + 1)) {
      if (!lowers(texts, [first, second], whole)) continue;
      return {
        separators: [first, second],
        split: false,
        whole,
        distinct: distinctFolded(splitAll(texts, [first, second])),
        limit,
        example: texts.find((text) => text.includes(first) && text.includes(second)) ?? null,
      };
    }
  }
  return null;
}

/** Characters looked for as a second separator: the ones the reader splits on, then the ones it never does. */
const SECOND_CANDIDATES: readonly string[] = [...MULTI_VALUE_DELIMITERS, ...UNSPLIT_DELIMITERS];

/** Every value the texts hold once split on each of `separators`, tidied. */
function splitAll(texts: string[], separators: readonly string[]): string[] {
  let parts = texts;
  for (const separator of separators) parts = parts.flatMap((part) => part.split(separator));
  return parts.map(tidySpaces).filter(Boolean);
}

/**
 * Whether splitting on `separators` puts them between values: each is used in
 * at least two cells, the parts are short and not all digits, and there are
 * fewer distinct values than the `whole` the texts held before. The same
 * tests `columnRules.splitFactors` puts to one separator.
 */
function lowers(texts: string[], separators: readonly string[], whole: number): boolean {
  if (separators.some((separator) => texts.filter((text) => text.includes(separator)).length < 2)) return false;
  const parts = splitAll(texts, separators);
  if (parts.some((part) => part.length > DELIMITER_MAX_PART_LENGTH)) return false;
  if (parts.every((part) => /^\d+$/.test(part))) return false;
  return distinctFolded(parts) < whole;
}

/**
 * What to say about a column whose values are separated, if anything.
 *
 * Two separators are always named: "B, C" left as one value after a split on
 * the semicolon is wrong however few values there are. With one, the column
 * is reported when splitting on it lowers the count of distinct values - so
 * it does sit between values - yet leaves more than a filter may hold: the
 * separator works, and is not enough. And a column read one value per cell
 * that has too many values as it is, yet would have few enough split, is
 * reported as not being split.
 */
function listWarning(list: ListReading): Omit<FileWarning, 'columns'> | null {
  const { separators, split, whole, distinct, limit } = list;
  const tooMany = distinct > limit;
  const merge = mergeFix(limit);
  const [main, second] = separators.map(delimiterName);

  if (separators.length === 2) {
    const quoted = list.example === null ? '' : ` ("${list.example}")`;
    const seen = split
      ? `is split on ${main}, but ${second} still sits between values inside the pieces${quoted}: it may use both.`
      : `is read as one value per cell, yet separates its values with both ${main} and ${second}${quoted}.`;
    const count = `Split on both, it holds ${distinct} distinct values${split ? '' : ` rather than ${whole}`}${tooMany ? `, still more than a filter may hold (${limit})` : ''}.`;
    return {
      kind: 'second-delimiter',
      message: `${seen} ${count}`,
      fix: `Split on both, and write every value separated by a semicolon.${tooMany ? ` Then ${lowerFirst(merge)}` : ''}`,
      separators,
    };
  }

  if (tooMany) {
    return split
      ? {
          kind: 'many-values',
          message: `splitting on ${main} brings it from ${whole} distinct values to ${distinct}: fewer, so it does sit between values, but still more than a filter may hold (${limit}).`,
          fix: `Look at what the split leaves for a second separator, and split on it too. ${merge}`,
        }
      : {
          kind: 'many-values',
          message: `is read as one value per cell, yet ${main} sits between values: splitting on it would bring it from ${whole} distinct values to ${distinct}, still more than a filter may hold (${limit}).`,
          fix: `Separate the values in this column with a semicolon throughout, and look among them for a second separator. ${merge}`,
        };
  }

  if (!split && whole > limit) {
    return {
      kind: 'unsplit-delimiter',
      message: `is read as one value per cell, with ${whole} distinct values - more than a filter may hold (${limit}) - yet ${main} sits between values: split on it, it would hold ${distinct}.`,
      fix: 'Separate the values in this column with a semicolon throughout, so it is read as a list.',
    };
  }
  return null;
}

/** The fix for a column with too many values, worded by how many a filter may hold. */
function mergeFix(limit: number): string {
  return `Merge the values of this column into fewer categories, one spelling each: ${limit} at most to filter on, ${COLOUR_MAX_CATEGORIES} or fewer to colour by.`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function distinctFolded(texts: string[]): number {
  return new Set(texts.map(folded).filter(Boolean)).size;
}

/** Lower-cased and tidied, so two spellings of one value count once. */
function folded(text: string): string {
  return tidySpaces(text).toLowerCase();
}

/**
 * A column that is a vocabulary, but too large a one: more distinct values
 * than a filter may hold (see `filterMaxCategories`), yet not one per cell
 * (`MANY_VALUES_MAX_RATIO`), so it is neither free text nor a category the
 * orbit can use. In a file that is nearly always one thing
 * spelled several ways, or categories cut finer than the question needs.
 * Judged on the column as its rule reads it, so a split that leaves sixty
 * fragments shows up here while the split is still in hand. A column of
 * numbers is a scale, not a vocabulary, and is left alone.
 */
function manyValues(dataset: Dataset, key: string): { distinct: number; filled: number; limit: number } | null {
  const column = findColumn(dataset, key);
  if (column === undefined || column.numeric || column.filled < 5) return null;
  const seen = new Set<string>();
  for (const row of dataset.rows) for (const value of cellValues(row, key)) seen.add(value);
  const distinct = seen.size;
  const limit = filterMaxCategories(dataset.rows.length);
  if (distinct <= limit || distinct > MANY_VALUES_MAX_RATIO * column.filled) return null;
  return { distinct, filled: column.filled, limit };
}

/**
 * A number with words or marks around it: "150 students", "~150", "41.7%",
 * "1,200", "n = 45". Not a word followed by a number ("Fall 2023", "Grade 10"),
 * which names a category, nor a code ("S01"), a date or a span of years.
 */
const NUMBER_WITH_WORDS = /^[~≈<>≤≥]?\s*\d[\d,.]*\s*(%|[A-Za-z]{1,12}(\s[A-Za-z]{1,12})?)?\s*$/;
const NAMED_NUMBER = /^[A-Za-z]{1,3}\s*[=:]\s*[~≈<>≤≥]?\s*\d[\d,.]*\s*%?$/;
const DATE = /^\d{4}-\d{2}-\d{2}/;
const YEAR_SPAN = /^\d{4}\s*[-–—]\s*\d{4}$/;

function isNumberInText(text: string): boolean {
  if (DATE.test(text) || YEAR_SPAN.test(text)) return false;
  return NUMBER_WITH_WORDS.test(text) || NAMED_NUMBER.test(text);
}

/**
 * The first cell that writes a number inside text, when enough of the column
 * does for that to be how the column is written - and only in a column that
 * is neither read as numbers already nor usable as a category as it is. A
 * column of "1 semester" and "2 semesters" is a category with two values, and
 * works as one.
 */
function numbersInText(column: ColumnInfo, texts: string[]): string | null {
  if (column.numeric || column.categorical) return null;
  const wordy = texts.filter(isNumberInText);
  if (wordy.length < Math.max(3, column.filled * NUMBERS_IN_TEXT_MIN_SHARE)) return null;
  return wordy[0];
}

/** What `String(object)` leaves of a nested JSON object. */
function isFlattenedObject(cell: CellValue): boolean {
  return cell === '[object Object]';
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
