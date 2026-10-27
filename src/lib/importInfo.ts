/**
 * What is known about the file a batch was read from, and what can still be
 * asked about it. Separate from the panels because two of them show it, and
 * because a module that exports a function alongside components breaks fast
 * refresh in development.
 */

/** How the loaded file was read, and the file itself so it can be read again. */
export interface ImportInfo {
  file: File;
  sheetNames: string[];
  sheetIndex: number;
  headerRow: number;
  totalRows: number;
  keptRows: number;
  grid: boolean;
}

/** How the file was read, without the file: the half of `ImportInfo` that localStorage can hold. */
export type ImportReading = Omit<ImportInfo, 'file'>;

/**
 * Whether the batch on screen will be here after a reload. `stored` is the
 * usual case. The other two say this browser refused to keep the batch - it
 * is the one stored thing large enough to be refused - and differ in whether
 * the file was kept instead (see `src/lib/importStore.ts`), so the batch can
 * be read again from it, or not, so a reload loses it.
 */
export type BatchKeeping = 'stored' | 'file' | 'lost';

/**
 * Said wherever a loaded batch is described, because the batch on screen is
 * right and only the next reload is affected. Null when there is nothing to
 * say.
 */
export function batchKeepingNotice(keeping: BatchKeeping): string | null {
  switch (keeping) {
    case 'stored':
      return null;
    case 'file':
      return 'This batch is too large for this browser to keep, so it is read from the file again each time the page opens. Nothing else is affected.';
    case 'lost':
      return 'This batch is too large for this browser to keep, and the file could not be kept either, so reloading the page will lose it. Nothing here is affected until then - to pick up where you left off, load the file again.';
  }
}

/**
 * True when there is anything to ask about how the file itself was read: a
 * workbook with one sheet, read as a format that carries its own column
 * names, leaves nothing to choose.
 */
export function hasFileReadingChoices(importInfo: ImportInfo | null): importInfo is ImportInfo {
  return importInfo !== null && (importInfo.grid || importInfo.sheetNames.length > 1);
}
