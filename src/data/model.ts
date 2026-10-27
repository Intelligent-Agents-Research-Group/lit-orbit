import { BAND_EDGES, PREFIX_SEPARATORS } from '../config/defaults';

/**
 * Core data model. Nothing here knows about React or the canvas.
 *
 * A batch is loaded from CSV / XLSX / JSON at runtime, so column names are
 * discovered from the file rather than declared in code. `ColumnInfo` records
 * what we inferred about each column and `ColumnMapping` records which
 * column plays which role in the orbit view.
 */

/** A single cell after normalisation: text, a number, several texts, or empty. */
export type CellValue = string | number | string[] | null;

export type PrefixSeparator = (typeof PREFIX_SEPARATORS)[number]['id'];

export type BandEdges = (typeof BAND_EDGES)[number];

/**
 * How one column's cells are read.
 *
 * Reading a spreadsheet column is a guess, and which guess is right is
 * something only the person who made the file knows: "Yes - we pre-loaded the
 * rubric" is one answer with a note attached, "Chat UI / Within IDE" is two
 * values, and a column of percentages is more useful in bands than as 36
 * separate numbers. So the guess is written down as a rule per column, shown
 * in *Column rules*, and changed there when it is wrong.
 *
 * `null` in a slot means that step does nothing. The steps run in order:
 * group numbers into bands, split the cell into several values, then cut each
 * value at its separator. See `lib/columnRules.ts`.
 */
export interface ColumnRule {
  /** Split a cell into several values on this character. */
  split: string | null;
  /** Keep only what comes before this separator. */
  prefix: PrefixSeparator | null;
  /** Group numbers into this many bands. */
  bands: number | null;
  /**
   * Where the bands are cut: into equal stretches of the scale between the
   * column's ends, or so that each holds about as many studies. Absent means
   * equal width, which is how every rule written before the choice existed
   * reads - in storage, in presets and in published sites.
   */
  bandEdges?: BandEdges;
}

/** Column key → how that column is read. Columns not named are read whole. */
export type ColumnRules = Record<string, ColumnRule>;

export type Row = Record<string, CellValue>;

export interface ColumnInfo {
  key: string;
  /** Nearly every non-empty cell is a number - see `NUMERIC_MIN_SHARE`. */
  numeric: boolean;
  /** Some cells hold several values (split on the multi-value delimiter). */
  multi: boolean;
  /** Sorted distinct values as strings; empty for free-text columns. */
  values: string[];
  /** Few enough distinct values to filter, group and colour by. */
  categorical: boolean;
  /** Every non-empty cell is different from every other (candidate label column). */
  unique: boolean;
  /** Number of non-empty cells. */
  filled: number;
  /** Ends of the scale, over the cells that are numbers; set when `numeric`. */
  min?: number;
  max?: number;
}

/** Which column plays which role. `null` means "none" (a sensible fallback is used). */
export interface ColumnMapping {
  labelKey: string | null;
  wedgeKey: string | null;
  colourKey: string | null;
  sizeKey: string | null;
  tierKey: string | null;
}

/**
 * Where the studies on screen come from. Chosen on the start screen: either
 * the batch that ships with the app, or a file the user loaded.
 */
export type DataMode = 'base' | 'own';

/**
 * A batch of studies. The stored one holds the cells as the file wrote them;
 * `readDataset` turns it into the one the screen uses, with every column read
 * under its rule. Both are this shape, so nothing downstream has to care
 * which it was handed.
 */
export interface Dataset {
  /** File name, or the name of the built-in batch. */
  name: string;
  source: 'base' | 'file';
  columns: ColumnInfo[];
  rows: Row[];
  /** How each column's cells are read. */
  rules: ColumnRules;
}

/** One row of the batch, with its label resolved through the mapping. */
export interface Study {
  /** Stable position in `dataset.rows`. */
  rowId: number;
  label: string;
  data: Row;
}

export const TIERS = [1, 2, 3, 4, 5] as const;
export type Tier = (typeof TIERS)[number];

export function isTier(value: number): value is Tier {
  return TIERS.some((tier) => tier === value);
}

/** Read a cell as a list of strings (empty list when the cell is empty). */
export function cellValues(row: Row, key: string | null): string[] {
  if (key === null) return [];
  const raw = row[key];
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw;
  return [String(raw)];
}

/** Read a cell as display text. */
export function cellText(row: Row, key: string | null): string {
  return cellValues(row, key).join(', ');
}

/**
 * Read a cell as a number, or `undefined` when it is empty or not one.
 *
 * The whole cell has to be a number, not just its first characters. A column
 * is offered as a scale when most of its cells are numbers (`NUMERIC_MIN_SHARE`),
 * and the promise made there is that the rest are drawn at the default size;
 * reading the digits off the front of "150 + ?" breaks that promise and sizes
 * a dot by a quantity the column's own ends were never measured over.
 */
export function cellNumber(row: Row, key: string | null): number | undefined {
  if (key === null) return undefined;
  const raw = row[key];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    // `Number('')` is 0, which would read an empty cell as a quantity.
    if (text === '') return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function findColumn(dataset: Dataset, key: string | null): ColumnInfo | undefined {
  return key === null ? undefined : dataset.columns.find((column) => column.key === key);
}
