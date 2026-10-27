import { buildDataset, readDataset } from '../lib/dataset';
import { parseFile } from '../lib/parse';
import { adaptRulesToDataset } from '../lib/tiers';
import { EXAMPLE_SETUP } from './example';
import type { BatchSetup, Preset } from './preset';

export const BASE_BATCH_NAME = 'Built-in batch';

/**
 * Fetch the batch that ships with the app and read it, set up the way its
 * setup says (`data/example.ts`). It is a spreadsheet under `public/` rather
 * than data compiled into the bundle, so a new version replaces it by
 * overwriting the file - nothing is regenerated and nothing is rebuilt.
 *
 * Handed another setup, it opens the app on that spreadsheet instead.
 */
export async function loadExample(setup: BatchSetup = EXAMPLE_SETUP): Promise<Preset> {
  const url = import.meta.env.BASE_URL + encodeURIComponent(setup.file);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${setup.file} could not be read (HTTP ${response.status}).`);
  return presetFromWorkbook(new File([await response.blob()], setup.file), setup);
}

/**
 * Read a spreadsheet the way `setup` says. It goes through the same reader as
 * a file the user loads, so there is one way of turning a spreadsheet into a
 * dataset rather than two.
 */
export async function presetFromWorkbook(file: File, setup: BatchSetup): Promise<Preset> {
  const parsed = await parseFile(file, { headerRow: setup.headerRow });
  const built = buildDataset(BASE_BATCH_NAME, parsed.rows, 'base');
  const batch = { ...built, rules: { ...built.rules, ...setup.columnRules } };
  return {
    batch,
    mapping: setup.mapping,
    filterKeys: setup.filterKeys,
    tierSource: setup.tierSource,
    // Fitted to the batch as it is read, as the starting rules are for any
    // file: the conditions name values the column rules above produce.
    tierRules: adaptRulesToDataset(setup.tierRules, readDataset(batch, batch.rules)),
    // The example names no course: the centre shows the default name.
    courseName: '',
  };
}
