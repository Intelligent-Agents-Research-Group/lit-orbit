import Papa from 'papaparse';
import type { CellValue, ColumnInfo, Dataset, Row } from '../data/model';
import type { OrbitNode } from './layout';
import { slug } from './text';

/**
 * Writing the studies on screen back out to a file.
 *
 * The app reads CSV, TSV, XLSX and JSON, and writes the same four, so a set
 * narrowed here can be handed to a colleague, kept beside the batch it came
 * from, or loaded straight back in as a batch of its own.
 *
 * `.txt` and `.xls` are read but not written: the first is a delimited table
 * under another name, which CSV and TSV already are, and the second is a
 * format Excel itself has been replacing for fifteen years.
 */

export type ExportFormat = 'csv' | 'tsv' | 'xlsx' | 'json';

export interface ExportFormatInfo {
  id: ExportFormat;
  /** Shown in the format dropdown. */
  name: string;
  extension: string;
  mime: string;
}

export const EXPORT_FORMATS: readonly ExportFormatInfo[] = [
  { id: 'csv', name: 'CSV', extension: 'csv', mime: 'text/csv;charset=utf-8' },
  { id: 'tsv', name: 'TSV', extension: 'tsv', mime: 'text/tab-separated-values;charset=utf-8' },
  {
    id: 'xlsx',
    name: 'Excel (XLSX)',
    extension: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  { id: 'json', name: 'JSON', extension: 'json', mime: 'application/json;charset=utf-8' },
] as const;

export function exportFormat(id: ExportFormat): ExportFormatInfo {
  return EXPORT_FORMATS.find((format) => format.id === id) ?? EXPORT_FORMATS[0];
}

/** The delimiter each text format is written with. */
const DELIMITERS: Partial<Record<ExportFormat, string>> = { csv: ',', tsv: '\t' };

/**
 * How a cell holding several values is written back into one that holds text.
 * A semicolon is what the reader tries first when it looks for a column that
 * holds lists, so a file written here is read back the way it was written.
 */
const MULTI_VALUE_JOIN = '; ';

/**
 * The ring the orbit put a study on, written as a column of its own.
 *
 * It is the one thing on screen that the file may not hold: with tier rules
 * the ring is worked out here, and even a batch with a "Tier" column of its
 * own can be naming a study design rather than a ring number, as the built-in
 * one does. So the column is added, under a name the batch is not already
 * using.
 */
export function tierColumnName(columns: readonly ColumnInfo[]): string {
  const taken = new Set(columns.map((column) => column.key.toLowerCase()));
  const candidates = ['Tier', 'Orbit tier'];
  for (const candidate of candidates) if (!taken.has(candidate.toLowerCase())) return candidate;
  let suffix = 2;
  while (taken.has(`orbit tier (${suffix})`)) suffix += 1;
  return `Orbit tier (${suffix})`;
}

/** The columns written, in file order: the ring first, then the batch as it is read now. */
export function exportKeys(dataset: Dataset): string[] {
  return [tierColumnName(dataset.columns), ...dataset.columns.map((column) => column.key)];
}

/**
 * The rows to write: the studies handed over, in the order they were handed
 * over, each holding every column of the batch as it is currently read.
 *
 * The panel that offers the download lists a few columns of a study; the file
 * carries all of them, because what a set is downloaded *for* is the work
 * that happens after this app.
 */
export function studyRows(nodes: readonly OrbitNode[], dataset: Dataset): Row[] {
  const tierKey = tierColumnName(dataset.columns);
  const keys = dataset.columns.map((column) => column.key);
  return nodes.map((node) => {
    const row: Row = { [tierKey]: node.tier };
    for (const key of keys) row[key] = node.study.data[key] ?? null;
    return row;
  });
}

/** A cell as a single value a spreadsheet cell can hold. */
function flatCell(cell: CellValue): string | number | null {
  if (Array.isArray(cell)) return cell.join(MULTI_VALUE_JOIN);
  return cell;
}

function textRows(rows: readonly Row[], keys: readonly string[]): (string | number | null)[][] {
  return rows.map((row) => keys.map((key) => flatCell(row[key] ?? null)));
}

/**
 * Excel reads a UTF-8 file as the local code page unless it opens with a
 * byte-order mark, which turns every accent in a title into mojibake. The
 * reader drops the mark again, so writing one costs the round trip nothing.
 */
const BOM = '﻿';

/** The chosen rows as a file, ready to be downloaded. */
export async function serialiseRows(
  rows: readonly Row[],
  keys: readonly string[],
  format: ExportFormat,
): Promise<Blob> {
  const { mime } = exportFormat(format);
  if (format === 'json') {
    // Written as the app holds it: numbers stay numbers and a cell holding
    // several values stays a list, which the reader understands.
    return new Blob([JSON.stringify(rows, null, 2)], { type: mime });
  }
  if (format === 'xlsx') {
    // Loaded on demand, as in `parse.ts`: the spreadsheet library is the
    // largest dependency and most sessions never touch a workbook.
    const { utils, write } = await import('xlsx');
    const sheet = utils.aoa_to_sheet([[...keys], ...textRows(rows, keys)]);
    const book = utils.book_new();
    utils.book_append_sheet(book, sheet, 'Studies');
    const buffer: ArrayBuffer = write(book, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: mime });
  }
  const text = Papa.unparse({ fields: [...keys], data: textRows(rows, keys) }, { delimiter: DELIMITERS[format] });
  return new Blob([BOM + text], { type: mime });
}

/**
 * What the file is called: the batch it came from, what was taken out of it,
 * and the format. A file name is the only label a download carries once it
 * has left the app, so it says which batch and which set rather than
 * `export (3).csv`.
 */
export function exportFileName(datasetName: string, part: string, format: ExportFormat): string {
  const withoutExtension = datasetName.replace(/\.[a-z0-9]+$/i, '');
  return `${slug(withoutExtension) || 'lit-orbit'}-${part}.${exportFormat(format).extension}`;
}

/** Hand a file to the browser to save. Nothing is uploaded: the blob is local. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // Firefox only follows a click on an anchor that is in the document.
  document.body.append(link);
  link.click();
  link.remove();
  // Released on the next tick: revoking while the download is still starting
  // cancels it in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
