import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TIER_RULES } from '../config/tierRules';
import { filterColumnCandidates, readDataset, sanitiseMapping } from '../lib/dataset';
import { assignTier } from '../lib/tiers';
import { presetFromWorkbook } from './base';
import { EXAMPLE_SETUP } from './example';
import { TIERS } from './model';

/**
 * The example as the app opens it: the file under `public/`, read under its
 * setup. The setup names columns and values of that one file, so these guard
 * the two against drifting apart when either is edited.
 */
async function openExample() {
  const bytes = readFileSync(new URL(`../../public/${EXAMPLE_SETUP.file}`, import.meta.url));
  const preset = await presetFromWorkbook(new File([bytes], EXAMPLE_SETUP.file), EXAMPLE_SETUP);
  return { preset, dataset: readDataset(preset.batch, preset.batch.rules) };
}

describe('the example batch', () => {
  it('holds 70 studies', async () => {
    const { dataset } = await openExample();
    expect(dataset.rows).toHaveLength(70);
  });

  it('has a column that can play every role its setup gives', async () => {
    const { preset, dataset } = await openExample();
    // A role whose column is missing, or cannot play it, is emptied here.
    expect(sanitiseMapping(preset.mapping, dataset)).toEqual(preset.mapping);
  });

  it('starts "Your course" on columns that can be filtered', async () => {
    const { preset, dataset } = await openExample();
    const filterable = filterColumnCandidates(dataset, preset.mapping).map((column) => column.key);
    expect(filterable).toEqual(expect.arrayContaining(preset.filterKeys));
  });

  it('writes column rules only for columns the file has', async () => {
    const { dataset } = await openExample();
    const keys = dataset.columns.map((column) => column.key);
    expect(keys).toEqual(expect.arrayContaining(Object.keys(EXAMPLE_SETUP.columnRules)));
  });

  it('keeps every tier rule, and puts studies on all five rings', async () => {
    const { preset, dataset } = await openExample();
    // Nothing was dropped in fitting the rules: every design they name is in the file.
    expect(preset.tierRules).toEqual(DEFAULT_TIER_RULES);
    const tiers = new Set(dataset.rows.map((row) => assignTier(row, preset.tierRules, preset.tierSource, null)));
    expect([...tiers].sort()).toEqual([...TIERS]);
  });
});
