import { describe, expect, it } from 'vitest';
import type { TierRule, TierSource } from '../config/tierRules';
import type { ColumnMapping } from '../data/model';
import { buildDataset, readDataset, studiesFrom } from './dataset';
import { computeOrbitModel, ringRadius, ORBIT_GEOMETRY, type OrbitNode } from './layout';
import type { FilterState } from './matching';
import type { RawRow } from './parse';

/**
 * How a filter shows on the orbit: it decides how a dot is drawn, and never
 * moves it. The data is invented - four yes / no settings, and a study for
 * every number of them it shares.
 */

const RAW: RawRow[] = [
  { Title: 'None', Tier: 2, A: 'no', B: 'no', C: 'no', D: 'no' },
  { Title: 'One', Tier: 2, A: 'yes', B: 'no', C: 'no', D: 'no' },
  { Title: 'Two', Tier: 2, A: 'yes', B: 'yes', C: 'no', D: 'no' },
  { Title: 'Three', Tier: 2, A: 'yes', B: 'yes', C: 'yes', D: 'no' },
  { Title: 'Four', Tier: 2, A: 'yes', B: 'yes', C: 'yes', D: 'yes' },
];

const MAPPING: ColumnMapping = {
  labelKey: 'Title',
  wedgeKey: null,
  colourKey: null,
  sizeKey: null,
  tierKey: 'Tier',
};

/** The orbit with the first `count` of the four settings asking for "yes". */
function orbitWith(count: number): Map<string, OrbitNode> {
  const stored = buildDataset('settings.csv', RAW, 'file');
  const dataset = readDataset(stored, stored.rules);
  const filters: FilterState = Object.fromEntries(['A', 'B', 'C', 'D'].slice(0, count).map((key) => [key, ['yes']]));
  const model = computeOrbitModel({
    dataset,
    studies: studiesFrom(dataset, MAPPING),
    mapping: MAPPING,
    filters,
    tierRules: [],
    tierSource: 'column',
  });
  return new Map(model.nodes.map((node) => [node.study.label, node]));
}

describe('drawing a dot by its match', () => {
  it('draws every study solid while nothing is set', () => {
    for (const node of orbitWith(0).values()) {
      expect(node).toMatchObject({ fullMatch: false, nearMiss: false, hidden: false });
    }
  });

  it('with one filter, keeps the matches and hides the rest', () => {
    const orbit = orbitWith(1);
    expect(orbit.get('None')).toMatchObject({ nearMiss: false, hidden: true });
    expect(orbit.get('One')).toMatchObject({ fullMatch: true, hidden: false });
  });

  it('with two filters, draws a study that misses one as a near miss', () => {
    const orbit = orbitWith(2);
    expect(orbit.get('None')).toMatchObject({ hidden: true });
    expect(orbit.get('One')).toMatchObject({ fullMatch: false, nearMiss: true, hidden: false });
    expect(orbit.get('Two')).toMatchObject({ fullMatch: true, nearMiss: false, hidden: false });
  });

  it('with more, hides every study that misses two or more', () => {
    const orbit = orbitWith(4);
    for (const label of ['None', 'One', 'Two']) {
      expect(orbit.get(label)).toMatchObject({ fullMatch: false, nearMiss: false, hidden: true });
    }
    expect(orbit.get('Three')).toMatchObject({ nearMiss: true, hidden: false });
    expect(orbit.get('Four')).toMatchObject({ fullMatch: true, hidden: false });
  });
});

describe('where a dot sits', () => {
  it('keeps a study on its ring whatever it matches', () => {
    const before = orbitWith(0);
    const after = orbitWith(4);
    for (const [label, node] of after) {
      expect(node.radius).toBe(before.get(label)!.radius);
      expect(node.angleOffset).toBe(before.get(label)!.angleOffset);
      expect(Math.abs(node.radius - ringRadius(node.tier))).toBeLessThanOrEqual(ORBIT_GEOMETRY.jitter + 1e-9);
    }
  });
});

describe('what a ring is called', () => {
  const labelsWith = (tierRules: TierRule[], tierSource: TierSource) => {
    const stored = buildDataset('designs.csv', RAW, 'file');
    const dataset = readDataset(stored, stored.rules);
    return computeOrbitModel({
      dataset,
      studies: studiesFrom(dataset, MAPPING),
      mapping: MAPPING,
      filters: {},
      tierRules,
      tierSource,
    }).tierLabels;
  };
  const catchAll: TierRule = { tier: 5, name: 'Other or not reported', conditions: [] };

  it('writes the values of one column on the rings they fill, and nothing on a ring no rule uses', () => {
    const rules: TierRule[] = [
      { tier: 1, name: '', conditions: [{ key: 'A', values: ['yes'] }] },
      { tier: 3, name: 'Tier 3', conditions: [{ key: 'A', values: ['no'] }] },
      catchAll,
    ];
    expect(labelsWith(rules, 'rules')).toEqual({ 1: 'yes', 2: '', 3: 'no', 4: '', 5: 'Other or not reported' });
  });

  it('keeps a name the user gave a ring', () => {
    const rules: TierRule[] = [
      { tier: 1, name: 'Everyone said yes', conditions: [{ key: 'A', values: ['yes'] }] },
      { tier: 2, name: '', conditions: [{ key: 'A', values: ['no'] }] },
      catchAll,
    ];
    expect(labelsWith(rules, 'rules')).toMatchObject({ 1: 'Everyone said yes', 2: 'no' });
  });

  it('numbers the rings when the rules read more than one column', () => {
    const rules: TierRule[] = [
      { tier: 1, name: '', conditions: [{ key: 'A', values: ['yes'] }] },
      { tier: 2, name: '', conditions: [{ key: 'B', values: ['yes'] }] },
      catchAll,
    ];
    expect(labelsWith(rules, 'rules')).toEqual({
      1: 'tier 1',
      2: 'tier 2',
      3: 'tier 3',
      4: 'tier 4',
      5: 'Other or not reported',
    });
  });

  it('writes only the number a cell holds when the rings are read from a column', () => {
    expect(labelsWith([catchAll], 'column')).toEqual({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' });
  });
});
