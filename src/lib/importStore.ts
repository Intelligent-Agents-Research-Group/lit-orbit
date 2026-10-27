import { IMPORT_FILE_STORE } from '../config/defaults';
import type { Dataset } from '../data/model';
import { buildDataset } from './dataset';
import type { ImportInfo, ImportReading } from './importInfo';
import { parseFile } from './parse';
import { readSiteFile, siteBatch } from './site';
import { storageKey } from './storage';

/**
 * The loaded file, kept between reloads.
 *
 * The batch read from it goes into localStorage with the rest of the setup;
 * the file itself cannot, because localStorage holds text. It goes into
 * IndexedDB, which holds a File as it is and has room for one of any size,
 * and how it was read - the sheet, the header row - goes into localStorage
 * beside the batch, so the two can be put back together when the page opens.
 *
 * Kept for two reasons. The sheet and the header row can be changed after a
 * reload, which used to need the file loaded again. And a batch too large
 * for localStorage is read from the file again instead of being lost - see
 * `recoverBatch`.
 *
 * Every failure here is swallowed: a browser that blocks IndexedDB - a
 * private window in some - leaves the app as it was before the file was
 * kept, which works.
 */

const { database: DATABASE, store: STORE, key: KEY } = IMPORT_FILE_STORE;

let opening: Promise<IDBDatabase> | null = null;

/** One connection, opened on first use and shared; a failure to open is retried on the next call. */
function database(): Promise<IDBDatabase> {
  if (opening === null) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available.'));
        return;
      }
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
    });
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

/** Run one request in a transaction of its own and settle with the transaction, not the request. */
async function inStore<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = act(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? new Error('The IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('The IndexedDB transaction was aborted.'));
  });
}

function readingOf(info: ImportInfo): ImportReading {
  const { file: _file, ...reading } = info;
  return reading;
}

/**
 * Keep the file and how it was read. True when the file is safely kept;
 * false when this browser would not keep it, which the user is told about
 * only if it comes to matter (see `BatchKeeping`).
 */
export async function keepImport(info: ImportInfo): Promise<boolean> {
  try {
    localStorage.setItem(storageKey('import'), JSON.stringify(readingOf(info)));
  } catch {
    // Storage is blocked or full: the reading is small, but without it the
    // file could not be read the same way, so it is not kept either.
    return false;
  }
  try {
    await inStore('readwrite', (store) => store.put(info.file, KEY));
    return true;
  } catch {
    return false;
  }
}

/** Drop the kept file. The reading beside it goes with `clearStoredData`, or is overwritten by the next file. */
export async function forgetImport(): Promise<void> {
  try {
    localStorage.removeItem(storageKey('import'));
  } catch {
    // Nothing was stored, so there is nothing to remove.
  }
  try {
    await inStore('readwrite', (store) => store.delete(KEY));
  } catch {
    // Same: a browser that would not keep the file has nothing to forget.
  }
}

/** The file this browser kept, with how it was read, or null when either half is missing. */
export async function restoreImport(): Promise<ImportInfo | null> {
  let reading: ImportReading;
  try {
    const stored = localStorage.getItem(storageKey('import'));
    if (stored === null) return null;
    reading = JSON.parse(stored) as ImportReading;
  } catch {
    return null;
  }
  try {
    const file = await inStore('readonly', (store) => store.get(KEY));
    return file instanceof File ? { file, ...reading } : null;
  } catch {
    return null;
  }
}

/** What the last visit left: the file with how it was read, and the batch read from it again when storage lost it. */
export interface KeptImport {
  info: ImportInfo;
  batch: Dataset | null;
}

/** Both halves of the last visit's import, put back together before the first render. */
export async function restoreKeptImport(): Promise<KeptImport | null> {
  const info = await restoreImport();
  if (info === null) return null;
  return { info, batch: await recoverBatch(info) };
}

/**
 * The batch, read again from the kept file when localStorage lost it.
 *
 * Only the batch can go missing: it is far the largest thing stored, and the
 * one write a browser refuses for want of room. When it is refused, the small
 * keys beside it persist, and so does the file - IndexedDB has the room - so
 * the next visit reads the file again the way it was read before, and opens
 * where the last one left off. Null when the batch is where it should be, or
 * when the file cannot be read.
 */
export async function recoverBatch(info: ImportInfo): Promise<Dataset | null> {
  try {
    if (localStorage.getItem(storageKey('dataset')) !== null) return null;
  } catch {
    return null;
  }
  try {
    const config = await readSiteFile(info.file);
    if (config) return siteBatch(config, 'file');
    const parsed = await parseFile(info.file, { sheetIndex: info.sheetIndex, headerRow: info.headerRow });
    return buildDataset(parsed.name, parsed.rows, 'file');
  } catch {
    return null;
  }
}
