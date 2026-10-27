import Papa from 'papaparse';
import { HEADER_MIN_FILL_RATIO, HEADER_SEARCH_DEPTH, MAX_ROWS } from '../config/defaults';
import { isRecord, parseJson } from './json';
import { stripBom } from './text';

/** One row straight from the file, before any normalisation. */
export type RawRow = Record<string, unknown>;

/** A sheet read as a grid of cells, before a header row has been chosen. */
type Matrix = unknown[][];

export interface ParsedFile {
  name: string;
  rows: RawRow[];
  /** Rows the file held before `MAX_ROWS` was applied. */
  totalRows: number;
  /** Sheet names when the file was a workbook; empty for CSV and JSON. */
  sheetNames: string[];
  /** Index into `sheetNames` of the sheet that was read. */
  sheetIndex: number;
  /**
   * 1-based line the column names came from, so the reader can say where it
   * started and the user can correct it. 0 means the format carries its own
   * names (JSON), or none were found and `Column 1..N` were used instead.
   */
  headerRow: number;
  /** The file was read as a grid of lines, so `headerRow` can be overridden. */
  grid: boolean;
}

/** Overrides for when the guesses below are wrong, numbered as in `ParsedFile`. */
export interface ParseOptions {
  sheetIndex?: number;
  headerRow?: number;
}

/**
 * Read a CSV / TSV / XLSX / JSON file into raw rows.
 *
 * Nothing about the shape of the table is assumed: the sheet holding the data,
 * the line the column names sit on and the width of the table are all
 * discovered here, because the files come from other people's workflows.
 */
export async function parseFile(file: File, options: ParseOptions = {}): Promise<ParsedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  let read: Omit<ParsedFile, 'name' | 'totalRows'>;
  if (extension === 'json') {
    read = readJson(await file.text(), options);
  } else if (extension === 'xlsx' || extension === 'xls' || extension === 'xlsm' || extension === 'xlsb') {
    read = await readWorkbook(await file.arrayBuffer(), options);
  } else {
    read = readText(await file.text(), options);
  }
  if (read.rows.length === 0) throw new Error(`No rows found in ${file.name}.`);
  const totalRows = read.rows.length;
  return { ...read, name: file.name, totalRows, rows: read.rows.slice(0, MAX_ROWS) };
}

// ---- Header detection -------------------------------------------------------

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function filledCount(row: unknown[]): number {
  let count = 0;
  for (const cell of row) if (!isEmptyCell(cell)) count += 1;
  return count;
}

/** Widest row in the sheet, counting only cells that hold something. */
function tableWidth(matrix: Matrix): number {
  let width = 0;
  for (const row of matrix) width = Math.max(width, filledCount(row));
  return width;
}

/** A row whose every filled cell is a number or a date is data, not column names. */
function looksLikeData(row: unknown[]): boolean {
  const cells = row.filter((cell) => !isEmptyCell(cell));
  if (cells.length === 0) return false;
  return cells.every(
    (cell) => cell instanceof Date || typeof cell === 'number' || /^-?[\d.,]+$/.test(String(cell).trim()),
  );
}

/**
 * Find the line the column names sit on.
 *
 * Real workbooks open with a title, a blank line, an export timestamp or all
 * three before the table starts, and a merged title cell leaves only one
 * filled cell on its row. So the header is the first line that is nearly as
 * wide as the widest line in the sheet. Returns -1 when there is no header.
 */
export function detectHeaderRow(matrix: Matrix): number {
  const width = tableWidth(matrix);
  if (width === 0) return -1;
  const limit = Math.min(matrix.length, HEADER_SEARCH_DEPTH);
  for (let index = 0; index < limit; index += 1) {
    const filled = filledCount(matrix[index]);
    if (filled === 0) continue;
    if (filled < width * HEADER_MIN_FILL_RATIO) continue;
    if (width > 1 && filled < 2) continue;
    return looksLikeData(matrix[index]) ? -1 : index;
  }
  return -1;
}

/** Column names: trimmed, never blank, never repeated. */
function columnNames(header: unknown[], width: number): string[] {
  const names: string[] = [];
  const seen = new Map<string, number>();
  for (let index = 0; index < width; index += 1) {
    const cell = header[index];
    const text = isEmptyCell(cell) ? '' : String(cell).trim().replace(/\s+/g, ' ');
    const base = text === '' ? `Column ${index + 1}` : text;
    const before = seen.get(base) ?? 0;
    seen.set(base, before + 1);
    names.push(before === 0 ? base : `${base} (${before + 1})`);
  }
  return names;
}

/**
 * Turn a grid into rows keyed by column name. Spacer columns (no name and no
 * data) and blank lines are dropped; every surviving row holds every key.
 */
function rowsFromMatrix(matrix: Matrix, headerIndex: number): RawRow[] {
  let width = 0;
  for (const row of matrix) width = Math.max(width, row.length);
  if (width === 0) return [];

  const header = headerIndex >= 0 ? matrix[headerIndex] : [];
  const body = matrix.slice(headerIndex + 1).filter((row) => filledCount(row) > 0);
  const names = columnNames(header, width);

  const keep: number[] = [];
  for (let index = 0; index < width; index += 1) {
    const named = !isEmptyCell(header[index]);
    const hasData = body.some((row) => !isEmptyCell(row[index]));
    if (named || hasData) keep.push(index);
  }

  return body.map((row) => Object.fromEntries(keep.map((index) => [names[index], row[index] ?? null])));
}

// ---- Formats ----------------------------------------------------------------

/** A 1-based override turned into an index, ignoring values outside the sheet. */
function overrideHeaderIndex(matrix: Matrix, headerRow: number | undefined): number | undefined {
  if (headerRow === undefined) return undefined;
  if (headerRow === 0) return -1;
  const index = headerRow - 1;
  return index >= 0 && index < matrix.length ? index : undefined;
}

function fromMatrix(matrix: Matrix, options: ParseOptions, sheetNames: string[], sheetIndex: number) {
  const headerIndex = overrideHeaderIndex(matrix, options.headerRow) ?? detectHeaderRow(matrix);
  return {
    rows: rowsFromMatrix(matrix, headerIndex),
    sheetNames,
    sheetIndex,
    headerRow: headerIndex + 1,
    grid: true,
  };
}

async function readWorkbook(buffer: ArrayBuffer, options: ParseOptions) {
  // Loaded on demand: the spreadsheet library is by far the largest
  // dependency and most sessions never open an XLSX file.
  const { read, utils } = await import('xlsx');
  // `cellDates` keeps dates as dates; without it they arrive as the serial
  // numbers Excel stores them as. `raw` keeps numbers unformatted.
  const workbook = read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) throw new Error('The workbook has no sheets.');

  const matrices = sheetNames.map((sheetName) =>
    utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    }),
  );
  const requested = options.sheetIndex;
  const sheetIndex =
    requested !== undefined && requested >= 0 && requested < sheetNames.length ? requested : pickSheet(matrices);
  return fromMatrix(matrices[sheetIndex], options, sheetNames, sheetIndex);
}

/**
 * The data is not always on the first sheet - workbooks often open with a
 * cover or a notes page. Prefer the sheet with the largest filled area, and
 * treat a single-column sheet as the weak match it usually is.
 */
function pickSheet(matrices: Matrix[]): number {
  let best = 0;
  let bestScore = -1;
  matrices.forEach((matrix, index) => {
    const width = tableWidth(matrix);
    const rows = matrix.reduce((count, row) => (filledCount(row) > 0 ? count + 1 : count), 0);
    const score = width < 2 ? width * rows : width * rows * 2;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

function readDelimitedText(text: string, options: ParseOptions) {
  const clean = stripBom(text);
  // Parsed without a header so the lines keep the numbers the user sees in
  // their editor, and so the header row can be chosen afterwards.
  const result = Papa.parse<unknown[]>(clean, { header: false, skipEmptyLines: false });
  // An "undetectable delimiter" warning is not a reliable signal - a perfectly
  // ordinary file earns one just by ending in a newline. What matters is
  // whether the result came out one column wide, which is the case for a
  // plain list of titles.
  const matrix = result.data.every((row) => row.length <= 1)
    ? clean.split(/\r?\n/).map((line) => [line.trim()])
    : result.data;
  return fromMatrix(matrix, options, [], 0);
}

/**
 * Read text that is a table, whatever the file was called. A list exported as
 * JSON is regularly saved with a .csv name, and reading it as CSV produces one
 * nonsense column rather than an error.
 */
function readText(text: string, options: ParseOptions) {
  if (looksLikeJson(text)) {
    try {
      return readJson(text, options);
    } catch {
      // Not JSON after all; fall through and read it as a delimited table.
    }
  }
  return readDelimitedText(text, options);
}

function readJson(text: string, options: ParseOptions) {
  const parsed = parseJson(text);
  const list = Array.isArray(parsed) ? parsed : firstArrayProperty(parsed);
  if (!list) throw new Error('JSON must be an array of objects (or an object holding one).');
  // An array of arrays is a grid like any other; an array of objects already
  // carries its column names.
  if (list.some(Array.isArray)) return fromMatrix(list.filter(Array.isArray), options, [], 0);
  const rows = list.filter(isRecord);
  if (rows.length === 0) throw new Error('JSON must be an array of objects (or an object holding one).');
  return { rows, sheetNames: [], sheetIndex: 0, headerRow: 0, grid: false };
}

// ---- Small helpers ----------------------------------------------------------

function looksLikeJson(text: string): boolean {
  const head = stripBom(text).trimStart().charAt(0);
  return head === '[' || head === '{';
}

function firstArrayProperty(value: unknown): unknown[] | undefined {
  if (!isRecord(value)) return undefined;
  return Object.values(value).find((property): property is unknown[] => Array.isArray(property));
}
