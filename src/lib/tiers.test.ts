import { describe, expect, it } from 'vitest';
import type { TierRule } from '../config/tierRules';
import { buildDataset, readDataset } from './dataset';
import { assignTier, pruneRuleValues, ringValueNames, tierFromRules, tierName } from './tiers';
import type { RawRow } from './parse';

/** A batch read under the rules detection chose for it, as the app does. */
const build = (rows: RawRow[]) => {
  const batch = buildDataset('test', rows, 'file');
  return readDataset(batch, batch.rules);
};

const rows: RawRow[] = [
  { Design: 'Randomised', Level: '300' },
  { Design: 'Single group', Level: '400' },
  { Design: 'Randomised', Level: '400' },
];

describe('reading a tier from rules', () => {
  it('puts a study on the ring of the first rule it satisfies', () => {
    const rules: TierRule[] = [
      { tier: 1, name: 'Randomised', conditions: [{ key: 'Design', values: ['Randomised'] }] },
      { tier: 4, name: 'One group', conditions: [{ key: 'Design', values: ['Single group'] }] },
    ];
    const dataset = build(rows);
    expect(dataset.rows.map((row) => tierFromRules(row, rules))).toEqual([1, 4, 1]);
  });

  /**
   * The panel reaches this state in one click - delete a rule's last condition,
   * or name a tier that never had one - and before the guard that rule claimed
   * the whole batch, because a rule with nothing to ask is satisfied by
   * everything.
   */
  it('ignores a rule with no conditions instead of letting it claim the batch', () => {
    const rules: TierRule[] = [
      { tier: 1, name: 'Named but never filled in', conditions: [] },
      { tier: 4, name: 'One group', conditions: [{ key: 'Design', values: ['Single group'] }] },
    ];
    const dataset = build(rows);
    expect(dataset.rows.map((row) => tierFromRules(row, rules))).toEqual([5, 4, 5]);
  });

  it('falls to the last ring when no rule matches', () => {
    const rules: TierRule[] = [
      { tier: 1, name: 'Randomised', conditions: [{ key: 'Design', values: ['Nothing says this'] }] },
    ];
    expect(tierFromRules(build(rows).rows[0], rules)).toBe(5);
  });

  it('reads the ring off a column when that is the chosen source', () => {
    const dataset = build([{ Tier: 2 }, { Tier: 9 }, { Tier: 'Not Reported' }]);
    const tiers = dataset.rows.map((row) => assignTier(row, [], 'column', 'Tier'));
    // Out of range is clamped; a cell that is not a number falls through to the rules.
    expect(tiers).toEqual([2, 5, 5]);
  });
});

describe('keeping stored rules usable', () => {
  const rules: TierRule[] = [
    {
      tier: 1,
      name: 'Randomised, upper level',
      conditions: [
        { key: 'Design', values: ['Randomised', 'Quasi-random'] },
        { key: 'Level', values: ['400'] },
      ],
    },
  ];

  it('drops the values a column no longer holds and keeps the rest', () => {
    const pruned = pruneRuleValues(rules, build(rows));
    expect(pruned[0].conditions).toEqual([
      { key: 'Design', values: ['Randomised'] },
      { key: 'Level', values: ['400'] },
    ]);
  });

  it('keeps the rule and the condition even when nothing of it is left', () => {
    const stale: TierRule[] = [
      { tier: 1, name: 'Gone', conditions: [{ key: 'Design', values: ['Written under an older rule'] }] },
    ];
    const pruned = pruneRuleValues(stale, build(rows));
    // The rule stays on the list, so the user can see it and re-pick; it just
    // stops matching, which `ruleMatches` already answers for an empty list.
    expect(pruned).toHaveLength(1);
    expect(pruned[0].conditions).toEqual([{ key: 'Design', values: [] }]);
    expect(tierFromRules(build(rows).rows[0], pruned)).toBe(5);
  });

  it('leaves a condition alone when its column lists no values to check against', () => {
    const free: TierRule[] = [{ tier: 1, name: 'Free text', conditions: [{ key: 'Notes', values: ['anything'] }] }];
    // Past `CATEGORICAL_MAX_DISTINCT` a column keeps no list of its values, so
    // there is nothing to prune against and the condition must be left alone.
    const dataset = build(Array.from({ length: 45 }, (_, index) => ({ Notes: 'a sentence, number ' + index })));
    expect(dataset.columns[0].values).toEqual([]);
    expect(pruneRuleValues(free, dataset)[0].conditions).toEqual([{ key: 'Notes', values: ['anything'] }]);
  });
});

describe('naming a ring by the values it takes', () => {
  const sort = (tier: TierRule['tier'], ...values: string[]): TierRule => ({
    tier,
    name: '',
    conditions: [{ key: 'Design', values }],
  });

  it('names each ring by its values when the rules sort one column, and leaves an unused ring blank', () => {
    const rules = [
      sort(1, 'Randomised'),
      sort(3, 'Single group', 'Case study'),
      { tier: 5 as const, name: '', conditions: [] },
    ];
    expect(ringValueNames(rules)).toEqual({ 1: 'Randomised', 2: '', 3: 'Single group or Case study', 4: '', 5: '' });
  });

  /**
   * Picking the column of a new condition comes before picking its values, so
   * the panel spends a moment on a condition that names no value - it places
   * no study, and must not count as a second column while it is set up.
   */
  it('passes over a rule that cannot place a study yet', () => {
    const waiting: TierRule = { tier: 2, name: '', conditions: [{ key: 'Level', values: [] }] };
    expect(ringValueNames([sort(1, 'Randomised'), waiting])).toMatchObject({ 1: 'Randomised', 2: '' });
  });

  it('gives up when the rules read two columns', () => {
    const level: TierRule = { tier: 2, name: '', conditions: [{ key: 'Level', values: ['400'] }] };
    expect(ringValueNames([sort(1, 'Randomised'), level])).toBeNull();
  });

  it('gives up when a rule asks two things, even of one column', () => {
    const both: TierRule = {
      tier: 1,
      name: '',
      conditions: [
        { key: 'Design', values: ['Randomised'] },
        { key: 'Design', values: ['Single group'] },
      ],
    };
    expect(ringValueNames([both])).toBeNull();
  });

  it('gives up when two rings name the same value', () => {
    expect(ringValueNames([sort(1, 'Randomised'), sort(2, 'Randomised', 'Single group')])).toBeNull();
  });

  it('gives up when no rule is in use', () => {
    expect(ringValueNames([{ tier: 5, name: 'Everything else', conditions: [] }])).toBeNull();
  });
});

describe('the name of a rule', () => {
  it('counts the number the panel used to give a new rule as no name', () => {
    expect(tierName({ tier: 2, name: 'Tier 2', conditions: [] })).toBe('');
    expect(tierName({ tier: 2, name: '  Comparison group ', conditions: [] })).toBe('Comparison group');
    expect(tierName(undefined)).toBe('');
  });
});
