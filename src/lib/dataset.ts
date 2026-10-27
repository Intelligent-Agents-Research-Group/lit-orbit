import {
  CATEGORICAL_MAX_DISTINCT,
  CATEGORICAL_MAX_RATIO,
  COLOUR_MAX_CATEGORIES,
  COLUMN_HINTS,
  DEFAULT_FILTER_COUNT,
  FILTER_MAX_CATEGORIES,
  NUMERIC_MAX_DIGITS,
  NUMERIC_MIN_SHARE,
  WEDGE_IDEAL_COUNT,
  WEDGE_MAX_COUNT,
} from '../config/defaults';
import {
  cellText,
  type CellValue,
  type ColumnInfo,
  type ColumnMapping,
  type ColumnRules,
  type Dataset,
  type Row,
  type Study,
} from '../data/model';
import { applyRule, detectRules, WHOLE } from './columnRules';
import { compareNumericValues, compareValues, tidySpaces } from './text';
import type { RawRow } from './parse';

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Build the batch as the file wrote it: every cell read on its own, and
 * nothing split, cut or grouped yet. What each column *should* become is
 * guessed into `rules`; `readDataset` is what applies them.
 *
 * Keeping the two apart is what lets the user change how a column is read
 * without the file being loaded again - the rule is re-applied to these cells
 * instead.
 */
export function buildDataset(name: string, rawRows: RawRow[], source: Dataset['source']): Dataset {
  const keys = columnKeys(rawRows);
  const rows: Row[] = rawRows.map((raw) => Object.fromEntries(keys.map((key) => [key, normaliseCell(raw[key])])));
  // A column that is empty everywhere is a spacer, not a variable.
  const columns = keys.map((key) => describeColumn(key, rows)).filter((column) => column.filled > 0);
  return { name, source, columns, rows, rules: detectRules(rows, keys) };
}

/**
 * The same batch with every column read under its rule: the dataset the rest
 * of the app works on. Cheap enough to recompute whenever a rule changes.
 */
export function readDataset(dataset: Dataset, rules: ColumnRules): Dataset {
  const keys = Object.keys(dataset.rows[0] ?? {});
  const rows: Row[] = dataset.rows.map((row) => ({ ...row }));
  for (const key of keys) {
    const read = applyRule(
      rows.map((row) => row[key]),
      rules[key] ?? WHOLE,
    );
    rows.forEach((row, index) => {
      row[key] = read[index];
    });
    unifySpelling(key, rows);
  }
  const columns = keys.map((key) => describeColumn(key, rows)).filter((column) => column.filled > 0);
  return { ...dataset, columns, rows, rules };
}

/** Every column name in the file, in the order the file gives them. */
function columnKeys(rawRows: RawRow[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const raw of rawRows) {
    for (const key of Object.keys(raw)) {
      if (key && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

/** Convert one cell on its own: text, a number, a date, several texts, or empty. */
export function normaliseCell(raw: unknown): CellValue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  if (raw instanceof Date) return formatDate(raw);
  if (Array.isArray(raw)) {
    const items = raw.map((item) => String(item).trim()).filter(Boolean);
    return items.length === 0 ? null : items.length === 1 ? items[0] : items;
  }
  const text = String(raw).trim();
  if (text === '') return null;
  return asNumber(text) ?? text;
}

/**
 * Read digits as a number only when they are a quantity. Identifiers that
 * happen to be digits (PMID, ISBN, a code with leading zeros) stay text:
 * as numbers they lose their leading zeros or their last digits.
 */
function asNumber(text: string): number | null {
  if (!NUMBER_PATTERN.test(text)) return null;
  if (/^-?0\d/.test(text)) return null;
  if (text.replace(/\D/g, '').length > NUMERIC_MAX_DIGITS) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Dates are shown as written, not as the serial number a spreadsheet stores. */
function formatDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const midnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
  return midnight ? day : `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Every string a cell holds, whether it is one value or a list. */
function textParts(cell: CellValue): string[] {
  if (typeof cell === 'string') return [cell];
  if (Array.isArray(cell)) return cell;
  return [];
}

/**
 * Tidy the spacing of every value, and in a column with few enough distinct
 * values also settle on one spelling per value, so that "RCT", "rct" and
 * "RCT " are one category with one colour rather than three.
 */
function unifySpelling(key: string, rows: Row[]): void {
  const spellings = new Map<string, Map<string, number>>();
  for (const row of rows) {
    for (const text of textParts(row[key])) {
      const tidied = tidySpaces(text);
      const bySpelling = spellings.get(tidied.toLowerCase()) ?? new Map<string, number>();
      bySpelling.set(tidied, (bySpelling.get(tidied) ?? 0) + 1);
      spellings.set(tidied.toLowerCase(), bySpelling);
    }
  }
  // Merging spellings only makes sense for a vocabulary, not for free text.
  const merge = spellings.size > 0 && spellings.size <= CATEGORICAL_MAX_DISTINCT;
  const canonical = new Map<string, string>();
  if (merge) for (const [folded, bySpelling] of spellings) canonical.set(folded, mostCommon(bySpelling));

  const rewrite = (text: string) => {
    const tidied = tidySpaces(text);
    return merge ? (canonical.get(tidied.toLowerCase()) ?? tidied) : tidied;
  };
  for (const row of rows) {
    const cell = row[key];
    if (typeof cell === 'string') row[key] = rewrite(cell);
    else if (Array.isArray(cell)) row[key] = cell.map(rewrite);
  }
}

/**
 * The spelling used most often. Ties are broken by plain code unit order
 * rather than `localeCompare`, so the same file gives the same answer on
 * every machine whatever its locale.
 */
function mostCommon(counts: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [text, count] of counts) {
    if (count > bestCount || (count === bestCount && text < best)) {
      best = text;
      bestCount = count;
    }
  }
  return best;
}

export function describeColumn(key: string, rows: Row[]): ColumnInfo {
  const cells = rows.map((row) => row[key]).filter((cell) => cell !== null);
  const multi = cells.some((cell) => Array.isArray(cell));
  const numbers = cells.filter((cell): cell is number => typeof cell === 'number');
  // Mostly numbers is enough - see `NUMERIC_MIN_SHARE`. The few cells that
  // hold something else are read as no value wherever the column is read as a
  // scale, and stay themselves everywhere else: they are still an answer.
  const numeric = numbers.length > 0 && numbers.length >= cells.length * NUMERIC_MIN_SHARE;
  const flat = cells.flatMap((cell) => (Array.isArray(cell) ? cell : [cell]));
  const distinct = [...new Set(flat.map(String))];
  distinct.sort(numeric ? compareNumericValues : compareValues);
  const ratioOk = cells.length < 5 || distinct.length <= CATEGORICAL_MAX_RATIO * cells.length;
  const categorical = distinct.length >= 2 && distinct.length <= CATEGORICAL_MAX_DISTINCT && ratioOk;
  const info: ColumnInfo = {
    key,
    numeric,
    multi,
    values: distinct.length <= CATEGORICAL_MAX_DISTINCT ? distinct : [],
    categorical,
    unique: !multi && cells.length > 0 && distinct.length === cells.length,
    filled: cells.length,
  };
  if (numeric) {
    info.min = Math.min(...numbers);
    info.max = Math.max(...numbers);
  }
  return info;
}

/** Pick the first column whose name matches one of the hint patterns, in hint order. */
function pickByHint(hints: readonly RegExp[], candidates: ColumnInfo[]): string | null {
  for (const hint of hints) {
    const hit = candidates.find((column) => hint.test(column.key));
    if (hit) return hit.key;
  }
  return null;
}

export function guessMapping(dataset: Dataset): ColumnMapping {
  const { columns, rows } = dataset;
  const complete = columns.filter((column) => column.filled === rows.length);
  const uniqueText = complete.filter((column) => column.unique && !column.numeric);

  // A column that says it is an id - id, DOI, ref id - names a study less
  // well than any other unique text column, so it is only the label when
  // nothing else can be. Left empty, a study is named by its row number.
  const idColumn = pickByHint(
    COLUMN_HINTS.id,
    complete.filter((column) => column.unique),
  );

  const labelKey =
    pickByHint(COLUMN_HINTS.label, uniqueText) ??
    pickByHint(COLUMN_HINTS.label, columns) ??
    uniqueText.find((column) => column.key !== idColumn)?.key ??
    idColumn;

  const wedgeCandidates = wedgeColumnCandidates(dataset).filter((column) => column.values.length <= WEDGE_MAX_COUNT);
  const wedgeKey =
    pickByHint(COLUMN_HINTS.wedge, wedgeCandidates) ??
    [...wedgeCandidates].sort(
      (a, b) => Math.abs(a.values.length - WEDGE_IDEAL_COUNT) - Math.abs(b.values.length - WEDGE_IDEAL_COUNT),
    )[0]?.key ??
    null;

  const colourCandidates = columns.filter(
    (column) => column.categorical && column.values.length <= COLOUR_MAX_CATEGORIES && column.key !== wedgeKey,
  );
  const colourKey =
    pickByHint(COLUMN_HINTS.colour, colourCandidates) ??
    colourCandidates.find((column) => !column.multi && column.values.length <= 5)?.key ??
    null;

  const sizeKey = pickByHint(COLUMN_HINTS.size, sizeColumnCandidates(dataset));
  const tierKey = pickByHint(COLUMN_HINTS.tier, tierColumnCandidates(dataset));

  return { labelKey, wedgeKey, colourKey, sizeKey, tierKey };
}

/**
 * Where a study is placed - which wedge it sits in, which ring it orbits on -
 * has to be one answer per row. A cell holding several values gives no single
 * answer, and the orbit would quietly place the study by the first of them as
 * if the rest were not written down, so a column read as a list is offered
 * for neither role. Reading it as one value per cell in *Column rules* brings
 * it back.
 */
function singleValued(column: ColumnInfo): boolean {
  return !column.multi;
}

/** Columns the circle can be cut by: a category, one per row. */
export function wedgeColumnCandidates(dataset: Dataset): ColumnInfo[] {
  return dataset.columns.filter((column) => column.categorical && singleValued(column));
}

/**
 * Columns the dots can be sized by. A column that is only mostly numbers
 * counts: the studies whose cell says something else are drawn at the default
 * size, which is already what a study with an empty cell there gets.
 */
export function sizeColumnCandidates(dataset: Dataset): ColumnInfo[] {
  return dataset.columns.filter((column) => column.numeric);
}

/**
 * Columns the dots can be coloured by: a category with no more values than
 * the palette has colours. Past that the legend stops being a key - most dots
 * share the one overflow colour - so the column is not offered.
 */
export function colourColumnCandidates(dataset: Dataset): ColumnInfo[] {
  return dataset.columns.filter((column) => column.categorical && column.values.length <= COLOUR_MAX_CATEGORIES);
}

/** Columns the rings can be read from: whole numbers 1 to 5, one per row. */
export function tierColumnCandidates(dataset: Dataset): ColumnInfo[] {
  return dataset.columns.filter(
    (column) =>
      singleValued(column) &&
      column.numeric &&
      column.values.length > 0 &&
      column.values.every((value) => Number.isInteger(Number(value))) &&
      (column.min ?? 0) >= 1 &&
      (column.max ?? 6) <= 5,
  );
}

/** How many distinct values a filter may have in a batch of this many rows - see `FILTER_MAX_CATEGORIES`. */
export function filterMaxCategories(rowCount: number): number {
  const { share, min, max } = FILTER_MAX_CATEGORIES;
  return Math.min(max, Math.max(min, Math.floor(rowCount * share)));
}

/**
 * Columns a user can filter on: a short enough list of values to read as the
 * settings of one course. A column with more is left out rather than offered
 * and then found useless.
 */
export function filterableColumns(dataset: Dataset): ColumnInfo[] {
  const limit = filterMaxCategories(dataset.rows.length);
  return dataset.columns.filter((column) => column.categorical && column.values.length <= limit);
}

/**
 * Columns the picture already answers: the wedge a dot sits in, the colour it
 * is painted, the size it is drawn at, the ring it orbits on.
 */
export function orbitRoleKeys(mapping: ColumnMapping): Set<string> {
  const roles = [mapping.wedgeKey, mapping.colourKey, mapping.sizeKey, mapping.tierKey];
  return new Set(roles.filter((key): key is string => key !== null));
}

/**
 * Columns "Your course" can be set by: filterable, and not already read by
 * the orbit. A column that places or paints a dot is answered by looking at
 * the picture, so filtering by it as well would ink a whole wedge - or a
 * whole colour - and hide the rest, spending a setting saying what the orbit
 * already shows.
 */
export function filterColumnCandidates(dataset: Dataset, mapping: ColumnMapping): ColumnInfo[] {
  const taken = orbitRoleKeys(mapping);
  return filterableColumns(dataset).filter((column) => !taken.has(column.key));
}

/** Filters to pre-populate: hinted "course context" columns first, then any column left. */
export function defaultFilterKeys(dataset: Dataset, mapping: ColumnMapping): string[] {
  const filterable = filterColumnCandidates(dataset, mapping);
  const picked: string[] = [];
  for (const hint of COLUMN_HINTS.filter) {
    for (const column of filterable) {
      if (hint.test(column.key) && !picked.includes(column.key)) picked.push(column.key);
    }
  }
  for (const column of filterable) {
    if (picked.length >= DEFAULT_FILTER_COUNT) break;
    if (!picked.includes(column.key)) picked.push(column.key);
  }
  return picked.slice(0, DEFAULT_FILTER_COUNT);
}

/** Resolve the label of every row through the mapping. */
export function studiesFrom(dataset: Dataset, mapping: ColumnMapping): Study[] {
  return dataset.rows.map((row, index) => ({
    rowId: index,
    label: cellText(row, mapping.labelKey) || `row-${index + 1}`,
    data: row,
  }));
}

/** Keep a stored mapping usable after the dataset changed: unknown columns become null. */
export function sanitiseMapping(mapping: ColumnMapping, dataset: Dataset): ColumnMapping {
  const known = new Set(dataset.columns.map((column) => column.key));
  const keep = (key: string | null) => (key !== null && known.has(key) ? key : null);
  // Three roles ask more than "the column is still there": a column whose
  // rule now reads several values per cell can no longer say where one study
  // belongs, and one now read as bands or as text has no number to size a dot
  // by. Those roles are emptied rather than left half-read.
  const keepOneOf = (key: string | null, candidates: ColumnInfo[]) =>
    candidates.some((column) => column.key === key) ? key : null;
  return {
    labelKey: keep(mapping.labelKey),
    wedgeKey: keepOneOf(mapping.wedgeKey, wedgeColumnCandidates(dataset)),
    // The colour asks the same of its column as the wedge does of its own: a
    // column whose rule has since given it more values than the palette holds
    // is dropped rather than left painting most of the batch one overflow
    // colour under a legend as long as the column.
    colourKey: keepOneOf(mapping.colourKey, colourColumnCandidates(dataset)),
    sizeKey: keepOneOf(mapping.sizeKey, sizeColumnCandidates(dataset)),
    tierKey: keepOneOf(mapping.tierKey, tierColumnCandidates(dataset)),
  };
}
