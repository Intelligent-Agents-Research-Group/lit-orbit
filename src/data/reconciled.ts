import type { TierRule } from '../config/tierRules';
import { CUT_AT_DASH, ONE_PER_LINE, SPLIT_ON_AND, WHOLE } from '../lib/columnRules';
import type { ColumnRule } from './model';
import type { BatchSetup } from './preset';

/**
 * The setup of the reconciled extraction the app used to open on, kept for
 * when it is used again. The spreadsheet itself is confidential: it is not in
 * the repository - `.gitignore` keeps it out wherever it sits - and must not
 * be published, so nothing imports this module.
 *
 * To open the app on it locally, copy the file into `public/` and hand this
 * setup to `loadExample` in `main.tsx`. Whatever `public/` holds is copied into
 * every build, so take the file out again before building anything that is
 * deployed or published.
 */

/**
 * The extraction records the study design in a column called "Tier", as the
 * name of the design rather than as a ring number, so the rules below turn one
 * into the other. Studies are ranked by what their design rules out: random
 * assignment first, then a non-random comparison group, then a single group
 * that at least acts as its own control, then a single group measured once.
 *
 * Each rule is named with the option as the coding form words it, so a ring is
 * labelled with what the coder actually picked rather than with a paraphrase
 * of it. The last ring carries the two options the coding form ends on, which
 * are also where an unrecognised or empty cell lands.
 */
const DESIGN = 'Tier';

const TIER_RULES: TierRule[] = [
  {
    tier: 1,
    name: '2+ Conditions, Random Assignment',
    conditions: [{ key: DESIGN, values: ['2+ Conditions, Random Assignment'] }],
  },
  {
    tier: 2,
    name: '2+ Conditions, Non-random Assignment',
    conditions: [{ key: DESIGN, values: ['2+ Conditions, Non-random Assignment'] }],
  },
  {
    tier: 3,
    name: 'Single Group Design with Within-Subject Conditions',
    conditions: [{ key: DESIGN, values: ['Single Group Design with Within-Subject Conditions'] }],
  },
  {
    tier: 4,
    name: 'Single Group Design',
    conditions: [{ key: DESIGN, values: ['Single Group Design'] }],
  },
  {
    tier: 5,
    name: 'Other / Not Reported',
    conditions: [],
  },
];

/**
 * How its columns are read. The extraction has conventions of its own:
 *
 * - most answers are written "Yes - <a paragraph saying how>", where only the
 *   first word is the answer and the rest is a note;
 * - columns that hold several answers put one per line, each of them written
 *   the same way;
 * - "Female percentage" is half numbers and half "Not Reported", which is far
 *   more useful as a few bands plus "Not Reported" than as 36 loose numbers;
 * - a study that ran across two levels or two regions is written "300 (Junior)
 *   and 400 (Senior)", which is two values rather than a seventh level. Too
 *   few rows say so for detection to risk it, so it is said here.
 *
 * Read this way, about two thirds of its 36 columns can be filtered on,
 * against a third when detection alone reads them.
 */
const LINES_CUT_AT_DASH: ColumnRule = { ...ONE_PER_LINE, prefix: 'dash' };

export const RECONCILED_SETUP: BatchSetup = {
  file: 'Reconciled Final Results Jingwen ver.xlsx',
  // The column names sit on the second line. The first holds the prompt each
  // column was extracted with, and it is as wide as the table, so the header
  // detector would take it for the header.
  headerRow: 2,
  // Spelled out rather than guessed: the name-based guesses land on the wrong
  // ones ("Course Title" as the label).
  mapping: {
    labelKey: 'Authors',
    wedgeKey: "GenAI's Role",
    colourKey: 'Where GenAI was used',
    // Two of the 76 cells here are not counts ("Not Reported" and "150 + ?").
    // The other 74 are, which is enough for the column to be read as a scale;
    // those two studies are drawn at the default size.
    sizeKey: 'Number of Participants',
    // Tiers come from the rules above, which read the "Tier" column: it names
    // a study design rather than a ring number.
    tierKey: null,
  },
  columnRules: {
    'Female percentage': { ...WHOLE, bands: 5 },
    'Course Level': SPLIT_ON_AND,
    Region: SPLIT_ON_AND,
    'Customized the GenAI or not': CUT_AT_DASH,
    'How GenAI was customized': { ...WHOLE, prefix: 'colon' },
    'Was GenAI usage directed': CUT_AT_DASH,
    'Are students trained?': CUT_AT_DASH,
    'Prior Experience': CUT_AT_DASH,
    'GenAI Allowed on Outcome Measure': CUT_AT_DASH,
    'Validity Evidence for Outcome Measure': CUT_AT_DASH,
    "GenAI's Role": CUT_AT_DASH,
    'Assignments type': LINES_CUT_AT_DASH,
    'Type of GenAI interface': LINES_CUT_AT_DASH,
    'Type of AI': LINES_CUT_AT_DASH,
    'GenAI tools used': LINES_CUT_AT_DASH,
    'Outcome Types Measured': LINES_CUT_AT_DASH,
    Audience: ONE_PER_LINE,
  },
  filterKeys: ['Course Level', 'CS or not', 'Coding or not', 'Institution'],
  tierSource: 'rules',
  tierRules: TIER_RULES,
};
