import { DEFAULT_TIER_RULES } from '../config/tierRules';
import { CUT_AT_DASH, ONE_PER_LINE, SPLIT_ON_AND, WHOLE } from '../lib/columnRules';
import type { BatchSetup } from './preset';

/**
 * The batch the app opens on: 70 invented studies of generative AI in
 * university computing courses, in `public/example-batch.xlsx`. None of them
 * is a real publication. They are written to show what the app does with a
 * batch, so the file keeps the habits real extractions have, and the rules
 * below read them:
 *
 * - three of its answers are written "Yes - <how>", where only the first word
 *   is the answer and the rest is a note;
 * - the tools and the outcomes of a study are listed one per line;
 * - a study run at two course levels, or in two regions, is written
 *   "Introductory and Intermediate" - too few rows say so for detection to
 *   risk splitting on "and";
 * - a third of "Women (%)" is "Not reported", which reads better as a few
 *   bands plus "Not reported" than as loose numbers.
 */

export const EXAMPLE_SETUP: BatchSetup = {
  file: 'example-batch.xlsx',
  // Spelled out rather than guessed: the name-based guesses would label the
  // studies by their titles, which are long for a tooltip.
  mapping: {
    labelKey: 'Study',
    wedgeKey: 'Role of GenAI',
    colourKey: 'Overall finding',
    // Three studies do not report it; they are drawn at the default size.
    sizeKey: 'Participants',
    // Tiers come from the rules in `config/tierRules.ts`, which read "Study design".
    tierKey: null,
  },
  columnRules: {
    Region: SPLIT_ON_AND,
    'Course level': SPLIT_ON_AND,
    'GenAI tools': ONE_PER_LINE,
    'Outcomes measured': ONE_PER_LINE,
    'Customised GenAI': CUT_AT_DASH,
    'GenAI use directed': CUT_AT_DASH,
    'Students trained': CUT_AT_DASH,
    'Women (%)': { ...WHOLE, bands: 5 },
  },
  filterKeys: ['Course level', 'Students', 'Programming language', 'Class size'],
  tierSource: 'rules',
  tierRules: DEFAULT_TIER_RULES,
};
