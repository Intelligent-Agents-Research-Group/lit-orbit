import { useRef, useState } from 'react';
import { buildDataset } from '../lib/dataset';
import type { BatchKeeping, ImportInfo } from '../lib/importInfo';
import { forgetImport, keepImport, type KeptImport } from '../lib/importStore';
import { parseFile, type ParseOptions } from '../lib/parse';
import { readSiteFile } from '../lib/site';
import type { StoredSetup } from './useStoredSetup';

/** Where a batch that has just been opened takes the user, or `null` to stay put. */
export type BatchDestination = 'data' | 'orbit' | null;

/** Reading files into the setup, and what is known about the file on screen. */
export interface BatchLoader {
  /** The loaded file and how it was read; `null` for the example, or when this browser did not keep the file. */
  importInfo: ImportInfo | null;
  /** Why the last file could not be loaded; `null` when it could. */
  error: string | null;
  clearError: () => void;
  /** Whether the batch on screen will be here after a reload. */
  batchKeeping: BatchKeeping;
  /** Load a file as a new batch. A new file opens on the first setup page, wherever it was loaded from. */
  loadBatch: (file: File) => void;
  /**
   * Read the loaded file again with a different sheet or header row: a
   * correction made from wherever the user already is, not a new file to be
   * set up, so the screen stays.
   */
  reimport: (options: ParseOptions) => void;
  /** Back to the example, which is already set up, so straight to the orbit. */
  chooseBaseBatch: () => void;
}

/**
 * Turns a file into the batch in `setup`, and keeps the file itself so the
 * batch can be read again with a different sheet or header row - in a store
 * of its own (see `lib/importStore.ts`), from which it comes back as `kept`
 * after a reload.
 *
 * `onBatchChange` is told whenever a different batch is on screen, with where
 * to take the user: the first setup page for a new file, the orbit for the
 * example, nowhere for a re-read of the same file.
 */
export function useBatchLoader({
  setup,
  kept,
  onBatchChange,
}: {
  setup: StoredSetup;
  kept: KeptImport | null;
  onBatchChange: (destination: BatchDestination) => void;
}): BatchLoader {
  const [importInfo, setImportInfo] = useState<ImportInfo | null>(kept?.info ?? null);
  // Whether this browser kept the file, which only matters when it would not
  // keep the batch: then the file is what the next visit opens on.
  const [fileKept, setFileKept] = useState(kept !== null);
  // The batch on screen was read from the kept file because storage had lost
  // it. It stays unkept for the session - nothing writes it again until a new
  // file is loaded - which the user is told about the same way as a refused
  // write.
  const [recovered, setRecovered] = useState(kept?.batch != null);
  const [error, setError] = useState<string | null>(null);
  // Reads of the batch are numbered so a slow one cannot land on top of a
  // faster one started after it. A row number typed into the header row box
  // is applied as it is typed, so two reads of a large workbook can easily be
  // in flight at once.
  const readCount = useRef(0);

  /**
   * The write of the batch was refused, or never made because the batch came
   * from the kept file: either way the file is what the next visit has, if it
   * was kept.
   */
  const batchKeeping: BatchKeeping = setup.batchTooBig || recovered ? (fileKept ? 'file' : 'lost') : 'stored';

  /**
   * The file and how it was read, on screen and in the store: the store is
   * written as the state is set, by the event that changed it, the way the
   * stored settings are. Whether the file was kept comes back later.
   */
  const changeImport = (info: ImportInfo | null) => {
    setImportInfo(info);
    if (info) {
      void keepImport(info).then(setFileKept);
    } else {
      setFileKept(false);
      void forgetImport();
    }
  };

  /** What every way of opening a batch has in common, once `setup` holds it. */
  const opened = (info: ImportInfo | null, destination: BatchDestination) => {
    setRecovered(false);
    setError(null);
    changeImport(info);
    onBatchChange(destination);
  };

  const load = async (file: File, options: ParseOptions, showSetup: boolean) => {
    const read = ++readCount.current;
    try {
      const siteConfig = await readSiteFile(file);
      if (read !== readCount.current) return;
      if (siteConfig) {
        // A site.json loaded as a batch: the author of a published site taking
        // it up again. Nothing about how the file was read is left to choose:
        // it holds the batch as a table that has already been read, column
        // names and all. It opens on the first setup page, as any new file does.
        setup.takeUpSite(siteConfig);
        const rows = siteConfig.batch.rows.length;
        opened(
          { file, sheetNames: [], sheetIndex: 0, headerRow: 0, totalRows: rows, keptRows: rows, grid: false },
          'data',
        );
        return;
      }
      const parsed = await parseFile(file, options);
      if (read !== readCount.current) return;
      setup.startBatch(buildDataset(parsed.name, parsed.rows, 'file'));
      opened(
        {
          file,
          sheetNames: parsed.sheetNames,
          sheetIndex: parsed.sheetIndex,
          headerRow: parsed.headerRow,
          totalRows: parsed.totalRows,
          keptRows: parsed.rows.length,
          grid: parsed.grid,
        },
        showSetup ? 'data' : null,
      );
    } catch (cause) {
      if (read !== readCount.current) return;
      setError('Could not load ' + file.name + ': ' + (cause instanceof Error ? cause.message : String(cause)));
    }
  };

  return {
    importInfo,
    error,
    clearError: () => setError(null),
    batchKeeping,
    loadBatch: (file) => void load(file, {}, true),
    reimport: (options) => {
      if (importInfo) void load(importInfo.file, options, false);
    },
    chooseBaseBatch: () => {
      setup.startBatch(null);
      opened(null, 'orbit');
    },
  };
}
