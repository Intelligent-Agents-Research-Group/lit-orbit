import type { Tier } from '../data/model';

/** `row[key]` must contain at least one of `values`. */
export interface TierCondition {
  key: string;
  values: string[];
}

/**
 * A tier rule matches when ALL of its conditions hold.
 * Rules are checked from tier 1 to tier 5; the first match wins.
 * A rule with no conditions matches everything (a catch-all).
 */
export interface TierRule {
  tier: Tier;
  name: string;
  conditions: TierCondition[];
}

/** Where a study's tier comes from: the rule list, or a numeric column of the file. */
export type TierSource = 'rules' | 'column';

/** The built-in batch records how each study was designed in a column of its own. */
const DESIGN = 'Study design';

/**
 * Starting rules (1 = strongest evidence, drawn on the innermost ring).
 * Studies are ranked by what their design rules out: random assignment first,
 * then a non-random comparison group, then a single group that at least acts
 * as its own control, then a single group measured once.
 *
 * Each rule is named with the design as the file words it, so a ring is
 * labelled with what the cell says rather than with a paraphrase of it - the
 * label on screen and the cell in the file read the same. The last ring holds
 * what no design above names - qualitative studies, and studies that report no
 * design - which is also where an unrecognised or empty cell lands.
 *
 * They reference the column names of the built-in batch; for another file
 * `adaptRulesToDataset` drops conditions whose column or values do not exist,
 * so the user starts from whatever still applies and edits the rest.
 */
export const DEFAULT_TIER_RULES: TierRule[] = [
  {
    tier: 1,
    name: 'Randomised controlled trial',
    conditions: [{ key: DESIGN, values: ['Randomised controlled trial'] }],
  },
  {
    tier: 2,
    name: 'Quasi-experimental',
    conditions: [{ key: DESIGN, values: ['Quasi-experimental'] }],
  },
  {
    tier: 3,
    name: 'Single-group pre-post',
    conditions: [{ key: DESIGN, values: ['Single-group pre-post'] }],
  },
  {
    tier: 4,
    name: 'Survey or observational',
    conditions: [{ key: DESIGN, values: ['Cross-sectional survey', 'Observational'] }],
  },
  {
    tier: 5,
    name: 'Other or not reported',
    conditions: [],
  },
];
