import { BAND_EDGES, PREFIX_SEPARATORS } from '../config/defaults';
import { SITE_CONFIG_FILE, SITE_MARKER } from '../config/publish';
import type { TierCondition, TierRule, TierSource } from '../config/tierRules';
import {
  isTier,
  type BandEdges,
  type CellValue,
  type ColumnMapping,
  type ColumnRule,
  type ColumnRules,
  type Dataset,
  type Row,
} from '../data/model';
import type { Preset } from '../data/preset';
import { WHOLE } from './columnRules';
import { buildDataset } from './dataset';
import { isRecord, parseJson } from './json';

/**
 * A site published from Lit Orbit: one batch, read the way its author set it
 * up, in a folder of its own. The app is the same one this page runs; what
 * makes it that site is `site.json` beside its index.html, which is what this
 * module writes and reads.
 *
 * The file holds the batch as the author's file wrote it and every choice
 * they made about reading it, and nothing a visitor decides: the settings of
 * a visitor's course are theirs.
 */

/** Written into every site.json, so a file of ours is told apart from any other JSON. */
const SITE_KIND = 'lit-orbit-site';

/**
 * The shape of site.json. A published site carries the app it was published
 * with, so it only ever reads the format it wrote; this number is for reading
 * one back into a later Lit Orbit, which refuses a format it does not know
 * rather than misreading it.
 */
export const SITE_FORMAT = 1;

/** What a published site says about itself, apart from its batch. */
export interface SiteInfo {
  /** Shown in the header and as the page title. */
  title: string;
  /** A sentence or two about the map, shown beside it. */
  description: string;
  /** The paper the map belongs to: a citation, a link, both or neither. */
  paper: { citation: string; url: string };
  /** The Lit Orbit it was made with, for the credit line; empty when not known. */
  madeWith: string;
}

/** Everything a published site is. See the top of this module. */
export interface SiteConfig extends SiteInfo {
  courseName: string;
  mapping: ColumnMapping;
  filterKeys: string[];
  tierSource: TierSource;
  tierRules: TierRule[];
  /** One rule per column, written out even when it reads the column whole. */
  columnRules: ColumnRules;
  /** The batch as the file wrote it, as a table: the column names once, then one list of cells per study. */
  batch: { name: string; columns: string[]; rows: CellValue[][] };
}

/** The author's setup, as the app holds it while they build their own orbit. */
export interface SiteSetup {
  /** The batch as the file wrote it - the stored one, not the read of it on screen. */
  batch: Dataset;
  /** How each column is read now: the guesses, with the author's changes on top. */
  columnRules: ColumnRules;
  mapping: ColumnMapping;
  filterKeys: string[];
  tierSource: TierSource;
  tierRules: TierRule[];
  courseName: string;
}

/**
 * What the author of a site typed about it in the publish dialog, kept as
 * typed - the paper link is only made into an address when the site is
 * written - so reopening the dialog shows what they left there.
 */
export interface PublishDraft {
  title: string;
  description: string;
  citation: string;
  paperUrl: string;
}

// ---- Writing -----------------------------------------------------------------

/**
 * The site.json for a setup. Every column gets its rule written out, even one
 * read whole: which columns a later Lit Orbit would guess a split for is not
 * something a published map should depend on.
 */
export function siteConfigFrom(setup: SiteSetup, info: SiteInfo): SiteConfig {
  const columns = Object.keys(setup.batch.rows[0] ?? {});
  return {
    title: info.title.trim(),
    description: info.description.trim(),
    paper: { citation: info.paper.citation.trim(), url: info.paper.url.trim() },
    madeWith: info.madeWith,
    courseName: setup.courseName.trim(),
    mapping: { ...setup.mapping },
    filterKeys: [...setup.filterKeys],
    tierSource: setup.tierSource,
    tierRules: setup.tierRules.map((rule) => ({
      ...rule,
      conditions: rule.conditions.map((condition) => ({ key: condition.key, values: [...condition.values] })),
    })),
    columnRules: Object.fromEntries(columns.map((key) => [key, { ...(setup.columnRules[key] ?? WHOLE) }])),
    batch: {
      name: setup.batch.name,
      columns,
      rows: setup.batch.rows.map((row) => columns.map((key) => row[key] ?? null)),
    },
  };
}

/**
 * site.json as text: the settings first, where they can be read, then the
 * batch with one study to a line, so a diff of two versions of a site shows
 * which studies changed rather than which cells moved.
 */
export function serialiseSiteConfig(config: SiteConfig): string {
  const { batch } = config;
  const head = JSON.stringify(
    {
      kind: SITE_KIND,
      format: SITE_FORMAT,
      title: config.title,
      description: config.description,
      paper: config.paper,
      madeWith: config.madeWith,
      courseName: config.courseName,
      mapping: config.mapping,
      filterKeys: config.filterKeys,
      tierSource: config.tierSource,
      tierRules: config.tierRules,
      columnRules: config.columnRules,
      batch: { name: batch.name, columns: batch.columns },
    },
    null,
    2,
  );
  const rows = batch.rows.map((row) => '      ' + JSON.stringify(row)).join(',\n');
  // The batch is the last key, so the text ends by closing it and then the
  // whole object; the rows go in just before the batch closes.
  return head.replace(/\n {2}}\n}$/, () => `,\n    "rows": [\n${rows}\n    ]\n  }\n}\n`);
}

// ---- Reading -----------------------------------------------------------------

/** True when `value` says it is a site.json, whether or not the rest of it holds up. */
export function isSiteConfig(value: unknown): boolean {
  return isRecord(value) && value.kind === SITE_KIND;
}

/**
 * Read a parsed site.json, checking every part the app will lean on.
 *
 * A site's own app wrote the file, but a file on a server is a file anyone
 * with the repository can edit by hand, so it is checked rather than trusted:
 * a mistake is reported by where it is, instead of surfacing later as a panel
 * that cannot render.
 */
export function readSiteConfig(value: unknown): SiteConfig {
  if (!isSiteConfig(value)) throw new Error(`This is not a Lit Orbit ${SITE_CONFIG_FILE}.`);
  const file = value as Record<string, unknown>;
  const format = file.format;
  if (typeof format !== 'number' || format > SITE_FORMAT || format < 1) {
    throw new Error(
      typeof format === 'number' && format > SITE_FORMAT
        ? `This ${SITE_CONFIG_FILE} was written by a newer Lit Orbit (format ${format}); this one reads format ${SITE_FORMAT}.`
        : `This ${SITE_CONFIG_FILE} does not say which format it is in.`,
    );
  }

  const paper = record(file.paper, 'paper');
  const batch = record(file.batch, 'batch');
  const columns = textList(batch.columns, 'batch.columns');
  if (columns.length === 0) invalid('batch.columns', 'at least one column name');
  const rowList = list(batch.rows, 'batch.rows');
  if (rowList.length === 0) invalid('batch.rows', 'at least one study');
  const rows = rowList.map((row, index) => {
    const cells = list(row, `batch.rows[${index}]`);
    if (cells.length > columns.length)
      invalid(`batch.rows[${index}]`, `no more cells than there are columns (${columns.length})`);
    return cells.map((cell, column) => readCell(cell, `batch.rows[${index}][${column}]`));
  });

  return {
    title: text(file.title, 'title'),
    description: text(file.description, 'description'),
    paper: { citation: text(paper.citation, 'paper.citation'), url: link(paper.url, 'paper.url') },
    madeWith: file.madeWith === undefined ? '' : link(file.madeWith, 'madeWith'),
    courseName: text(file.courseName, 'courseName'),
    mapping: readMapping(file.mapping),
    filterKeys: textList(file.filterKeys, 'filterKeys'),
    tierSource: readTierSource(file.tierSource),
    tierRules: list(file.tierRules, 'tierRules').map((rule, index) => readTierRule(rule, `tierRules[${index}]`)),
    columnRules: readColumnRules(file.columnRules),
    batch: { name: text(batch.name, 'batch.name'), columns, rows },
  };
}

/** Fetch and read the site.json a published page names in its marker (see `SITE_MARKER`). */
export async function loadSite(fileName: string): Promise<SiteConfig> {
  const response = await fetch(import.meta.env.BASE_URL + encodeURI(fileName));
  if (!response.ok) throw new Error(`${fileName} could not be read (HTTP ${response.status}).`);
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(`${fileName} is not valid JSON.`);
  }
  return readSiteConfig(parsed);
}

/**
 * The site.json in a file handed to the batch loader, so its author can take
 * the site up again where they left it; `null` when the file is anything else.
 * A file that says it is one and then fails a check is an error, not a batch:
 * read as a table, it would come out as whatever list it holds first.
 */
export async function readSiteFile(file: File): Promise<SiteConfig | null> {
  if (!/\.json$/i.test(file.name)) return null;
  let parsed: unknown;
  try {
    parsed = parseJson(await file.text());
  } catch {
    return null;
  }
  return isSiteConfig(parsed) ? readSiteConfig(parsed) : null;
}

/**
 * The batch as the author's file wrote it, rebuilt from the table in
 * site.json. It goes through `buildDataset` again, which leaves cells it
 * already built as they are, so the columns come out described exactly as
 * they were; the rules are then set to the ones written down, column by
 * column.
 */
export function siteBatch(config: SiteConfig, source: Dataset['source']): Dataset {
  const { columns, rows } = config.batch;
  const rawRows = rows.map((cells): Row =>
    Object.fromEntries(columns.map((key, index) => [key, cells[index] ?? null])),
  );
  const dataset = buildDataset(config.batch.name, rawRows, source);
  return { ...dataset, rules: { ...dataset.rules, ...config.columnRules } };
}

/** A published site's batch, set up the way its author left it. */
export function presetFromSite(config: SiteConfig): Preset {
  return {
    batch: siteBatch(config, 'base'),
    mapping: config.mapping,
    filterKeys: config.filterKeys,
    tierSource: config.tierSource,
    tierRules: config.tierRules,
    courseName: config.courseName,
  };
}

// ---- The page ----------------------------------------------------------------

/**
 * The app's index.html, turned into a published site's: its title in the tab
 * and in link previews - both read before any script runs - and the marker
 * that tells the app which site.json to read.
 */
export function publishedIndexHtml(html: string, config: SiteConfig): string {
  const title = /<title>[\s\S]*?<\/title>/;
  if (!title.test(html) || !html.includes('</head>')) throw new Error('index.html is not the one Lit Orbit builds.');
  const meta = [`<meta name="${SITE_MARKER}" content="${SITE_CONFIG_FILE}" />`];
  if (config.description) meta.push(`<meta name="description" content="${escapeHtml(config.description)}" />`);
  // Replaced through functions, so a `$` in a title is written rather than
  // read as a pattern. The tags go in one level deeper than `</head>` sits.
  return html
    .replace(title, () => `<title>${escapeHtml(config.title || 'Lit Orbit')}</title>`)
    .replace(
      /([ \t]*)<\/head>/,
      (_match, indent: string) => meta.map((tag) => `${indent}  ${tag}\n`).join('') + `${indent}</head>`,
    );
}

/**
 * The prefix a published site's keys are stored under (see `lib/storage.ts`):
 * the folder it is served from, which is what tells two sites on one host apart.
 */
export function siteStorageNamespace(href: string): string {
  return `site:${new URL('.', href).pathname}:`;
}

/**
 * A link to the paper as the author typed it, made into an address: a bare
 * DOI becomes a doi.org link and a bare domain gets https. `null` when it is
 * not a web address at all - a published page links nothing else.
 */
export function paperLink(input: string): string | null {
  const typed = input.trim();
  if (typed === '') return '';
  const doi = /^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i.exec(typed);
  const candidate = doi ? `https://doi.org/${doi[1]}` : /^[a-z][a-z\d+.-]*:/i.test(typed) ? typed : `https://${typed}`;
  try {
    const url = new URL(candidate);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Checks ------------------------------------------------------------------

function invalid(path: string, expected: string): never {
  throw new Error(`${SITE_CONFIG_FILE} cannot be read: "${path}" should be ${expected}.`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  return isRecord(value) ? value : invalid(path, 'an object');
}

function list(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : invalid(path, 'a list');
}

function text(value: unknown, path: string): string {
  return typeof value === 'string' ? value : invalid(path, 'text');
}

function textOrNull(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path);
}

function textList(value: unknown, path: string): string[] {
  return list(value, path).map((item, index) => text(item, `${path}[${index}]`));
}

/** An address the page may link to: empty, or http(s) - never `javascript:` or the like. */
function link(value: unknown, path: string): string {
  const url = text(value, path);
  return url === '' || /^https?:\/\//i.test(url) ? url : invalid(path, 'an http(s) address, or empty');
}

function readCell(value: unknown, path: string): CellValue {
  if (value === null || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value as string[];
  return invalid(path, 'text, a number, a list of texts, or null');
}

// A site.json written before the id role was dropped still carries `idKey`;
// it is not read, so such a file opens as it always did.
const MAPPING_KEYS = ['labelKey', 'wedgeKey', 'colourKey', 'sizeKey', 'tierKey'] as const;

function readMapping(value: unknown): ColumnMapping {
  const mapping = record(value, 'mapping');
  const read = Object.fromEntries(MAPPING_KEYS.map((key) => [key, textOrNull(mapping[key] ?? null, `mapping.${key}`)]));
  return read as unknown as ColumnMapping;
}

function readTierSource(value: unknown): TierSource {
  return value === 'rules' || value === 'column' ? value : invalid('tierSource', '"rules" or "column"');
}

function readTierRule(value: unknown, path: string): TierRule {
  const rule = record(value, path);
  const tier = rule.tier;
  if (typeof tier !== 'number' || !isTier(tier)) invalid(`${path}.tier`, 'a whole number from 1 to 5');
  const conditions = list(rule.conditions, `${path}.conditions`).map((item, index): TierCondition => {
    const condition = record(item, `${path}.conditions[${index}]`);
    return {
      key: text(condition.key, `${path}.conditions[${index}].key`),
      values: textList(condition.values, `${path}.conditions[${index}].values`),
    };
  });
  return { tier, name: text(rule.name, `${path}.name`), conditions };
}

const PREFIX_IDS: readonly string[] = PREFIX_SEPARATORS.map((separator) => separator.id);
const EDGE_IDS: readonly string[] = BAND_EDGES;

function readColumnRules(value: unknown): ColumnRules {
  const rules = record(value, 'columnRules');
  return Object.fromEntries(
    Object.entries(rules).map(([key, item]): [string, ColumnRule] => {
      const path = `columnRules.${key}`;
      const rule = record(item, path);
      const prefix = rule.prefix ?? null;
      if (prefix !== null && (typeof prefix !== 'string' || !PREFIX_IDS.includes(prefix))) {
        invalid(`${path}.prefix`, `null or one of ${PREFIX_IDS.join(', ')}`);
      }
      const bands = rule.bands ?? null;
      if (bands !== null && (typeof bands !== 'number' || !Number.isInteger(bands) || bands < 2)) {
        invalid(`${path}.bands`, 'null or a whole number of at least 2');
      }
      // Optional: a site published before the choice existed cuts at equal width.
      const bandEdges = rule.bandEdges;
      if (bandEdges !== undefined && (typeof bandEdges !== 'string' || !EDGE_IDS.includes(bandEdges))) {
        invalid(`${path}.bandEdges`, `absent or one of ${EDGE_IDS.join(', ')}`);
      }
      return [
        key,
        {
          split: textOrNull(rule.split ?? null, `${path}.split`),
          prefix: prefix as ColumnRule['prefix'],
          bands: bands as number | null,
          ...(bandEdges === undefined ? {} : { bandEdges: bandEdges as BandEdges }),
        },
      ];
    }),
  );
}
