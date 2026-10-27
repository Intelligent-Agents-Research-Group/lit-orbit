import type { TierRule, TierSource } from '../config/tierRules';
import {
  TIERS,
  cellNumber,
  cellValues,
  findColumn,
  type ColumnMapping,
  type Dataset,
  type Study,
  type Tier,
} from '../data/model';
import { activeFilters, matchCount, type FilterState } from './matching';
import { compareValues } from './text';
import { FALLBACK_TIER, assignTier, ringValueNames, tierName } from './tiers';

/**
 * Geometry of the orbit, as fractions of the outer radius (rMax).
 * Tier 1 sits on the innermost ring, and a study stays on the ring of its
 * tier whatever the filters say: filters decide whether and how strongly a
 * dot is drawn, never where it sits.
 *
 * A dot's angle inside the wedge comes from the study's colour and label
 * alone, so one colour sits as a band across the wedge, and setting a filter
 * never slides a dot past its neighbours - the same dot answering the filter,
 * not a new one.
 */
export const ORBIT_GEOMETRY = {
  /** rMax as a fraction of min(width, height). */
  radiusScale: 0.42,
  centreRadius: 0.115,
  /** The most the centre may grow to hold the course name (see `layoutCentreLabel`). */
  centreMaxRadius: 0.2,
  innermostRing: 0.3,
  ringGap: 0.155,
  /** Fraction of a wedge's arc that studies may spread across. */
  wedgeSpread: 0.74,
  /** Radial jitter to reduce overlap between neighbours inside one cell. */
  jitter: 0.014,
  /** Dot radius range in px (sqrt-scaled by the "size by" column). */
  dotMin: 4,
  dotMax: 9,
  dotDefault: 5.5,
  dotHoverScale: 1.5,
  ringLabelOffset: 13,
  wedgeLabelRadius: 1.03,
  /** Horizontal room (px) kept free on each side for wedge labels. */
  labelRoom: 84,
  minLabelWidth: 40,
} as const;

export interface OrbitNode {
  study: Study;
  tier: Tier;
  /** Active filters this study satisfies. */
  match: number;
  /** True when at least one filter is set and all of them match. */
  fullMatch: boolean;
  /** At least two filters are set and the study misses exactly one: drawn half-transparent. */
  nearMiss: boolean;
  /** Neither a full match nor a near miss while a filter is set: not drawn. */
  hidden: boolean;
  wedge: number;
  /** Value of the "colour by" column (first value for multi-valued cells). */
  category: string;
  /** Index into the categorical palette. */
  colourIndex: number;
  /** Dot radius in px at rest. */
  size: number;
  /** Angle within the wedge, radians, relative to the wedge centre. Fixed: it
   * depends on the colours and labels in the cell, never on the filters. */
  angleOffset: number;
  /** Distance from the centre as a fraction of rMax. */
  radius: number;
}

export interface OrbitModel {
  nodes: OrbitNode[];
  wedgeLabels: string[];
  /** What each ring is called, drawn on the ring itself. */
  tierLabels: Record<Tier, string>;
  /** Legend entries for the "colour by" column, in palette order. */
  categories: string[];
  activeFilterCount: number;
}

export interface OrbitModelInput {
  dataset: Dataset;
  studies: Study[];
  mapping: ColumnMapping;
  filters: FilterState;
  tierRules: TierRule[];
  tierSource: TierSource;
}

export const NO_VALUE_LABEL = 'Not reported';

export function ringRadius(tier: Tier): number {
  return ORBIT_GEOMETRY.innermostRing + (tier - 1) * ORBIT_GEOMETRY.ringGap;
}

/** Pure data step: decides every study's tier, match, wedge, colour, size and polar slot. */
export function computeOrbitModel(input: OrbitModelInput): OrbitModel {
  const { dataset, studies, mapping, filters, tierRules, tierSource } = input;
  const active = activeFilters(filters);

  // With no wedge column the circle is not cut at all, so it gets no labels:
  // a single word riding round the orbit names nothing.
  const wedgeLabels = mapping.wedgeKey ? distinctPrimaryValues(studies, mapping.wedgeKey) : [];
  const categories = mapping.colourKey ? distinctPrimaryValues(studies, mapping.colourKey) : [];
  const sizeMax = findColumn(dataset, mapping.sizeKey)?.max ?? 0;

  const nodes: OrbitNode[] = studies.map((study) => {
    const match = matchCount(study, active);
    const category = mapping.colourKey ? primaryValue(study, mapping.colourKey) : '';
    return {
      study,
      tier: assignTier(study.data, tierRules, tierSource, mapping.tierKey),
      match,
      ...matchLook(match, active.length),
      wedge: Math.max(0, wedgeLabels.indexOf(primaryValue(study, mapping.wedgeKey))),
      category,
      colourIndex: mapping.colourKey ? categories.indexOf(category) : 0,
      size: dotSize(cellNumber(study.data, mapping.sizeKey), sizeMax),
      angleOffset: 0,
      radius: 0,
    };
  });

  // Group into (wedge, tier) cells and spread each cell across its arc.
  const cells = new Map<string, OrbitNode[]>();
  for (const node of nodes) {
    const key = node.wedge + ':' + node.tier;
    const cell = cells.get(key);
    if (cell) cell.push(node);
    else cells.set(key, [node]);
  }
  const wedgeAngle = (2 * Math.PI) / Math.max(wedgeLabels.length, 1);
  const spread = wedgeAngle * ORBIT_GEOMETRY.wedgeSpread;

  for (const cell of cells.values()) {
    // Ordered by the study alone - never by match - so a dot keeps its slot
    // and a filter only changes its ink. Ranking the cell by match instead
    // swapped neighbours around on every filter change, which reads as the
    // dots being shuffled rather than as this dot answering the filter.
    // Colour leads the order so that one category lands as a band across the
    // wedge; picking a different "colour by" column re-seats the cell, which
    // is a re-layout the user asked for.
    cell.sort(
      (a, b) =>
        a.colourIndex - b.colourIndex || a.study.label.localeCompare(b.study.label) || a.study.rowId - b.study.rowId,
    );
    const slots = evenOffsets(cell.length, spread);
    cell.forEach((node, index) => {
      node.angleOffset = slots[index];
      node.radius = ringRadius(node.tier) + ((index % 3) - 1) * ORBIT_GEOMETRY.jitter;
    });
  }

  return {
    nodes,
    wedgeLabels,
    tierLabels: tierLabelsFor(tierRules, tierSource, mapping.tierKey),
    categories,
    activeFilterCount: active.length,
  };
}

/**
 * How a study that matches `match` of `active` filters is drawn: solid when it
 * meets them all, half-transparent when it misses one, and not at all when it
 * misses more. A study that shares nothing is never a near miss, so with a
 * single filter a study either meets it or is left off.
 */
export function matchLook(match: number, active: number): Pick<OrbitNode, 'fullMatch' | 'nearMiss' | 'hidden'> {
  const fullMatch = active > 0 && match === active;
  const nearMiss = active > 1 && match === active - 1;
  return { fullMatch, nearMiss, hidden: active > 0 && !fullMatch && !nearMiss };
}

/**
 * What to write on each ring: what puts a study there, in the words of the
 * file, which says what the ring means in a way its number cannot.
 *
 * - Tiers read from a column: the number its cells hold, on its own. The
 *   column is the tier, so its name would only say "tier" again.
 * - A rule the user named: that name. For the built-in batch it is the option
 *   the coder picked.
 * - Rules that sort one column into rings (`ringValueNames`): the values a ring
 *   takes, and nothing on a ring no rule uses - no study can sit there. The
 *   last ring holds whatever no rule claimed, so it keeps its name or number.
 * - Anything else keeps its number.
 *
 * An empty label is not drawn.
 */
function tierLabelsFor(rules: TierRule[], source: TierSource, tierKey: string | null): Record<Tier, string> {
  const labels = (label: (tier: Tier) => string) =>
    Object.fromEntries(TIERS.map((tier) => [tier, label(tier)])) as Record<Tier, string>;
  if (source === 'column' && tierKey !== null) return labels((tier) => String(tier));
  const byValue = ringValueNames(rules);
  return labels((tier) => {
    const name = tierName(rules.find((rule) => rule.tier === tier));
    if (name) return name;
    if (byValue === null || tier === FALLBACK_TIER) return 'tier ' + tier;
    return byValue[tier];
  });
}

/** Evenly spaced offsets across [-spread/2, spread/2], in cell order. */
function evenOffsets(count: number, spread: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => (i / (count - 1) - 0.5) * spread);
}

function primaryValue(study: Study, key: string | null): string {
  return cellValues(study.data, key)[0] ?? NO_VALUE_LABEL;
}

function distinctPrimaryValues(studies: Study[], key: string): string[] {
  const values = [...new Set(studies.map((study) => primaryValue(study, key)))];
  return values.sort(compareValues);
}

function dotSize(value: number | undefined, max: number): number {
  if (value === undefined || max <= 0) return ORBIT_GEOMETRY.dotDefault;
  // Clamped at both ends: `max` is measured over the cells the column reads as
  // numbers, so a cell read some other way must not be able to draw a dot
  // larger than the largest count in the batch.
  const t = Math.min(1, Math.sqrt(Math.max(0, value) / max));
  return ORBIT_GEOMETRY.dotMin + t * (ORBIT_GEOMETRY.dotMax - ORBIT_GEOMETRY.dotMin);
}

/* ------------------------------------------------------------------------- */
/* Screen-space helpers used by the canvas renderer on every frame.          */
/* ------------------------------------------------------------------------- */

export interface Point {
  x: number;
  y: number;
}

/** Where the orbit sits on a stage of this size, and how big it is. */
export function orbitGeometry(width: number, height: number): { centre: Point; rMax: number } {
  const rMax = Math.max(
    40,
    Math.min(
      Math.min(width, height) * ORBIT_GEOMETRY.radiusScale,
      (width / 2 - ORBIT_GEOMETRY.labelRoom) / ORBIT_GEOMETRY.wedgeLabelRadius,
    ),
  );
  return { centre: { x: width / 2, y: height / 2 }, rMax };
}

/**
 * How wide a wedge label may be. This is the room it has out at the far left
 * and right of the orbit, where its own width counts against the edge of the
 * stage, and so the narrowest room it will ever have. Cutting it to fit there
 * keeps its wording the same all the way round; measuring the room against the
 * current angle instead made a long label grow and shrink as it turned.
 */
export function wedgeLabelRoom(width: number, rMax: number): number {
  return Math.max(ORBIT_GEOMETRY.minLabelWidth, width / 2 - ORBIT_GEOMETRY.wedgeLabelRadius * rMax - 6);
}

export function nodeAngle(node: OrbitNode, wedgeCount: number, spin: number): number {
  const wedgeAngle = (2 * Math.PI) / Math.max(wedgeCount, 1);
  return node.wedge * wedgeAngle + wedgeAngle / 2 + node.angleOffset + spin;
}

export function nodePoint(node: OrbitNode, wedgeCount: number, spin: number, centre: Point, rMax: number): Point {
  const angle = nodeAngle(node, wedgeCount, spin);
  const r = node.radius * rMax;
  return { x: centre.x + Math.cos(angle) * r, y: centre.y + Math.sin(angle) * r };
}

export function wedgeCentreAngle(index: number, wedgeCount: number, spin: number): number {
  const wedgeAngle = (2 * Math.PI) / Math.max(wedgeCount, 1);
  return index * wedgeAngle + wedgeAngle / 2 + spin;
}

export function wedgeBoundaryAngle(index: number, wedgeCount: number, spin: number): number {
  return (index * 2 * Math.PI) / Math.max(wedgeCount, 1) + spin;
}
