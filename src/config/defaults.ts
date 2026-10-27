/**
 * Tunable defaults. Column *names* are never assumed here — only patterns
 * used to guess a sensible starting mapping for a freshly loaded file.
 */

/**
 * Cells like "Code generation; Debugging help" hold several values. Which
 * character separates them differs per file and per column, so the delimiter
 * is detected per column (see `detectDelimiter`) from these candidates rather
 * than fixed. A comma is included but is near the last resort, because it is
 * far more often part of a title or an author list than a separator, and the
 * word "and" is last of all: "300 (Junior) and 400 (Senior)" is two values,
 * but so much prose is held together by the same word.
 */
export const MULTI_VALUE_DELIMITERS = [';', '|', '\n', '、', '/', ',', ' and '] as const;

/**
 * Cells like "Yes - the tool was pre-loaded with the course rubric" answer in
 * their first words and explain in the rest. These are the separators a
 * column can be cut at, so that only the answer is kept. A dash has to be
 * spaced to count, or "Non-random" would be cut in half; a colon has to be
 * followed by a space, or "10:30" would.
 */
export const PREFIX_SEPARATORS = [
  { id: 'dash', name: 'a dash', pattern: /\s[—–-]\s/ },
  { id: 'colon', name: 'a colon', pattern: /:\s/ },
] as const;

/** How many bands a numeric column can be grouped into. */
export const BAND_COUNT_CHOICES = [3, 4, 5, 6] as const;

/**
 * Where a numeric column's bands are cut. Equal width cuts the scale between
 * the column's ends into equal stretches, so one far-off number - a mean age
 * of 45 among students of 20 - squeezes nearly every study into one band and
 * leaves the rest empty. Equal count cuts so that each band holds about as
 * many studies, at the price of bands that cover unequal stretches.
 */
export const BAND_EDGES = ['equalWidth', 'equalCount'] as const;

/** A column is split only when the delimiter shows up in at least this share of its cells. */
export const DELIMITER_MIN_SHARE = 0.3;

/**
 * A delimiter that shows up in at least this share of a column's cells is
 * offered as a way to read it, whatever splitting on it does to the column.
 * Below it, a delimiter is offered only when splitting lowers the count of
 * distinct values (see `ruleOptions`). The dropdown is where the user says
 * what the file means, so a character this common is theirs to try, even
 * where the reader judged it to be part of the text.
 */
export const DELIMITER_OFFER_MIN_SHARE = 0.08;

/** Split parts longer than this look like prose, so the delimiter is punctuation, not structure. */
export const DELIMITER_MAX_PART_LENGTH = 60;

/**
 * Characters a column is *not* split on, but that people do write between
 * values: "Chat UI + IDE", "Python & Java". The file check looks for them so
 * it can say the column holds lists the app will read as one value each - and
 * so the instruction it writes for an AI can ask for a semicolon instead.
 */
export const UNSPLIT_DELIMITERS = [' + ', ' & ', ' or ', '•'] as const;

/**
 * A column mixes its separators when two of them each sit between values
 * and each is used *without* the other in at least this share of the cells
 * that hold either - "A; B" in some rows and "A, B" in others. Cells that hold
 * both do not count: "A; B, C" in every row is one separator inside another,
 * not two used interchangeably.
 */
export const MIXED_DELIMITER_MIN_SHARE = 0.15;

/**
 * A column is reported as numbers written inside text ("150 students",
 * "41.7%", "n = 45") when at least this share of its cells read that way, and
 * never fewer than three: one such cell is a note, not a column's habit.
 */
export const NUMBERS_IN_TEXT_MIN_SHARE = 0.3;

/**
 * A column is reported as too large a vocabulary when it yields more distinct
 * values than a filter may hold (see `FILTER_MAX_CATEGORIES`) but no more
 * than this share of its filled cells. Above it the column is free text - a
 * title, a note - and nothing is wrong with it; below it some values repeat,
 * so one thing may be written several ways or the categories cut finer than
 * needed. Set just under 1, so only a column where every cell differs is
 * taken for free text: a single repeated value is already a sign that the
 * column meant to be a vocabulary. Looser than `CATEGORICAL_MAX_RATIO`, which
 * decides what the orbit will use: this is about what the file meant.
 *
 * A column read as a list is not held to this share. Its split lowering the
 * count of distinct values already shows it is a vocabulary, so whenever what
 * is left is still more than a filter may hold, it is reported.
 */
export const MANY_VALUES_MAX_RATIO = 0.99;

/**
 * A column name longer than this is a sentence, which is what a line of data
 * looks like when the header row was guessed one line too far down.
 */
export const COLUMN_NAME_MAX_LENGTH = 60;

/**
 * A row holding a single cell, in a table at least this wide, is a note or a
 * total rather than a study. Narrower tables are left alone: in a table of
 * three columns a study with two cells unfilled is still a study.
 */
export const NOTE_ROW_MIN_COLUMNS = 4;

/** A column is categorical when it has 2..N distinct values and not too many relative to rows. */
export const CATEGORICAL_MAX_DISTINCT = 40;
export const CATEGORICAL_MAX_RATIO = 0.6;

/** How far into a sheet to look for the column names before giving up. */
export const HEADER_SEARCH_DEPTH = 25;

/** The header is the first line filled to at least this share of the sheet's width. */
export const HEADER_MIN_FILL_RATIO = 0.6;

/** Rows beyond this are dropped: the orbit cannot show them and storage cannot hold them. */
export const MAX_ROWS = 5000;

/**
 * Digits are only read as a number below this many characters. Longer runs are
 * identifiers (ISBN, PMID, phone-like codes) that lose precision as numbers.
 */
export const NUMERIC_MAX_DIGITS = 15;

/**
 * How much of a column has to be numbers for the column to count as a numeric
 * one - offered as the dot size, and sorted on the scale rather than by
 * spelling. Not all of it: a column of counts with two cells reading "Not
 * Reported" is still a column of counts, and losing the column over those two
 * costs far more than it protects. They are read as no value, which is what
 * an empty cell in the same column already means.
 */
export const NUMERIC_MIN_SHARE = 0.8;

/** The "colour by" column should have at most this many values (size of the palette). */
export const COLOUR_MAX_CATEGORIES = 8;

/**
 * A numeric column is offered bands only when it holds at least this many
 * distinct numbers. With no more than the palette has colours, every number
 * can already be a value of its own - coloured, wedged, filtered on - so
 * grouping them gains nothing, and equal bands would cut between them at
 * fractions nobody wrote: ratings 1 to 5 in three bands read "1–2.3",
 * "2.3–3.7", "3.7–5".
 */
export const BAND_MIN_DISTINCT = COLOUR_MAX_CATEGORIES + 1;

/**
 * A column can become a filter only up to a share of the batch's rows in
 * distinct values, kept between `min` and `max`. Past it the row of values
 * stops reading as a setting of the user's course and turns into a search
 * box, and a filter almost nothing satisfies leaves next to nothing on the
 * orbit. A bigger batch has more studies behind each value, so it can carry a
 * longer row before that happens - but not without end.
 *
 * `min` is set well above what the palette holds, because nothing here has
 * to be given a colour: however small the batch, a column of tools, venues or
 * countries can run to a few dozen values and still be one of the more useful
 * things to filter on. At 30 it leaves the share little to do: the limit is 30
 * up to 206 rows, 31 from 207, and one more about every seven rows after
 * that, to 40 from 267.
 *
 * A filter's column has to be a category as well (`CATEGORICAL_MAX_RATIO`,
 * `CATEGORICAL_MAX_DISTINCT`), so in a batch of fewer than 50 rows its values
 * run out of repeats before they reach 30, and `max` is the most a category
 * may hold in any batch.
 */
export const FILTER_MAX_CATEGORIES = { share: 0.15, min: 30, max: 40 } as const;

/**
 * Whether a study that meets every setting of "Your course" is ringed as well
 * as drawn solid. Without the ring, solid alone tells it from a near miss,
 * which is drawn half-transparent.
 */
export const RING_FULL_MATCHES = true;

/** Preferred number of wedges when guessing the "wedge by" column. */
export const WEDGE_IDEAL_COUNT = 6;
export const WEDGE_MAX_COUNT = 14;

/** How many filters to pre-populate in the "Your course" panel. */
export const DEFAULT_FILTER_COUNT = 4;

/** How many rows the "closest studies" list shows before "show all". */
export const LIST_PREVIEW_SIZE = 30;

/** How many rows of the batch the setup page shows as a preview. */
export const PREVIEW_ROWS = 8;

/** How many of a column's values the setup page lists under the preview before counting the rest. */
export const PREVIEW_VALUES = 24;

/**
 * The width, in px, the layout is drawn for. A narrower window still works
 * - the panels stack under the orbit - but everything is cramped, so a
 * dialog says so once each time the window drops below it.
 *
 * It is the width at which the three columns give way, so it has to be the
 * same number as the media query in `components/OrbitScreen.module.css`: the dialog
 * names it, and a dialog naming a width the layout does not change at tells
 * the user the stacking starts somewhere it does not.
 */
export const MIN_WINDOW_WIDTH = 960;

/**
 * How far each side panel may be dragged, in px. The width it starts at is
 * the token in `styles/tokens.css`; a width the user drags to is kept per
 * browser and written back into the same token.
 */
export const PANEL_WIDTH_LIMITS = {
  rail: { min: 220, max: 460 },
  detail: { min: 300, max: 640 },
} as const;

/** How much an arrow key moves a panel edge, in px. */
export const PANEL_RESIZE_STEP = 16;

/**
 * Patterns for guessing column roles, tried in order. The first categorical /
 * numeric / unique column (as appropriate) whose name matches wins.
 */
export const COLUMN_HINTS = {
  id: [/^id$/i, /_id$/i, /^doi$/i, /^key$/i, /^ref(erence)?[_ ]?id$/i, /^no\.?$/i],
  label: [/label/i, /title/i, /citation/i, /^paper$/i, /^study$/i, /author/i, /^name$/i, /reference/i],
  wedge: [/role/i, /category/i, /approach/i, /intervention/i, /type/i, /design/i],
  colour: [/direction/i, /outcome/i, /result/i, /effect/i, /finding/i],
  size: [/class[_ ]?size/i, /sample/i, /participant/i, /^n$/i, /size/i, /count/i],
  tier: [/tier/i, /evidence/i, /quality/i, /strength/i],
  filter: [/level/i, /major/i, /cohort/i, /subject/i, /assignment/i, /course/i, /context/i, /grade/i],
} as const;

/** Colour tokens handed out, in order, to the values of the "colour by" column. */
export const CATEGORY_COLOUR_TOKENS = [
  '--color-cat-1',
  '--color-cat-2',
  '--color-cat-3',
  '--color-cat-4',
  '--color-cat-5',
  '--color-cat-6',
  '--color-cat-7',
  '--color-cat-8',
] as const;

export const CATEGORY_OVERFLOW_TOKEN = '--color-cat-overflow';

/**
 * Longest course name the setup page takes. The name is written inside the
 * circle at the centre of the orbit, on up to three lines, and past about
 * this length it no longer fits there without shrinking out of reading size.
 */
export const COURSE_NAME_MAX_LENGTH = 30;

/**
 * The course the centre names when the user has not named one: the course the
 * example batch was gathered for. Written in the circle at the centre of the
 * orbit, shown greyed in the course name box, and drawn on the landing page a
 * line at a time.
 */
export const DEFAULT_COURSE_NAME_LINES = ['GenAI', 'and CS Ed'] as const;
export const DEFAULT_COURSE_NAME = DEFAULT_COURSE_NAME_LINES.join(' ');

/** File formats both loaders accept, as an <input type="file"> accept list. */
export const IMPORT_FILE_TYPES = '.csv,.tsv,.txt,.xlsx,.xls,.json';

/**
 * localStorage keys — bump the version suffix if a stored shape changes.
 * Everything here except the appearance and the panel widths is cleared by `clearStoredData`.
 */
export const STORAGE_KEYS = {
  dataset: 'lit-orbit.dataset.v2',
  dataMode: 'lit-orbit.dataMode.v1',
  mapping: 'lit-orbit.mapping.v1',
  columnRules: 'lit-orbit.columnRules.v1',
  filters: 'lit-orbit.filters.v2',
  filterKeys: 'lit-orbit.filters.v1.keys',
  tierRules: 'lit-orbit.tierRules.v1',
  tierSource: 'lit-orbit.tierSource.v1',
  /** The name the user gave their course, written in the circle at the centre of the orbit. */
  courseName: 'lit-orbit.courseName.v1',
  /** What the user wrote about their map the last time they published it as a website. */
  publish: 'lit-orbit.publish.v1',
  /** How the loaded file was read - the sheet, the header row - so the kept file can be read the same way. */
  import: 'lit-orbit.import.v1',
  /** Where the user runs the code the file check asks an AI for: a script, a notebook, or Colab. */
  codeTarget: 'lit-orbit.codeTarget.v1',
  appearance: 'lit-orbit.appearance.v1',
  railWidth: 'lit-orbit.railWidth.v1',
  detailWidth: 'lit-orbit.detailWidth.v1',
} as const;

/**
 * Where the loaded file itself is kept between reloads: an IndexedDB store,
 * because localStorage holds text and a File is not text. See
 * `src/lib/importStore.ts`.
 */
export const IMPORT_FILE_STORE = { database: 'lit-orbit', store: 'files', key: 'import' } as const;

/**
 * Keys an earlier version stored and this one no longer reads. Nothing writes
 * them any more, but a browser that used that version still holds them, so
 * `clearStoredData` removes them with the rest.
 */
export const RETIRED_STORAGE_KEYS = [
  /** The AI-selected shortlist: row numbers, and a fingerprint of their batch. */
  'lit-orbit.selection.v2',
] as const;
