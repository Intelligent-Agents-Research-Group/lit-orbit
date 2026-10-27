import type { TierRule, TierSource } from '../config/tierRules';
import type { ColumnMapping, ColumnRules, Dataset } from './model';

/**
 * A batch that arrives already set up: the example we ship, or the batch of a
 * site published from Lit Orbit. Everything a user would otherwise decide on
 * the setup pages has been decided here - by us for the example, by the
 * site's author for a published one.
 */
export interface Preset {
  /**
   * The batch as the file wrote it, with `source: 'base'`: to the page it is
   * on, it is the batch that ships. Its `rules` say how every column is read.
   */
  batch: Dataset;
  mapping: ColumnMapping;
  /** The rows "Your course" starts with. */
  filterKeys: string[];
  tierSource: TierSource;
  /** Used as they stand, pruned against the batch on every read like any rules the user built. */
  tierRules: TierRule[];
  /** Written at the centre of the orbit; empty shows the default name instead. */
  courseName: string;
}

/**
 * A spreadsheet we know, and how to read it: everything the setup pages would
 * otherwise ask about the file, decided once and written down. The example is
 * opened this way (see `data/base.ts`), and a batch that cannot ship keeps its
 * setup this way until it can (see `data/reconciled.ts`).
 */
export interface BatchSetup {
  /** The spreadsheet's file name, under `public/`. */
  file: string;
  /** The 1-based line the column names are on, when the header detector would pick another. */
  headerRow?: number;
  /**
   * Which column plays which role. Keys the file no longer has are dropped, so
   * a new version of the file that renames a column falls back to "none"
   * rather than to a missing column.
   */
  mapping: ColumnMapping;
  /**
   * How the columns that need it are read. Detection only ever guesses at
   * splitting, so a column that has to be cut or grouped - or split where too
   * few cells show it for a guess - is named here. Every other column keeps
   * the rule detection chose.
   */
  columnRules: ColumnRules;
  /** The rows "Your course" starts with. */
  filterKeys: string[];
  tierSource: TierSource;
  /** Fitted to the batch when it is read, as the starting rules are for any file. */
  tierRules: TierRule[];
}
