import { DEFAULT_TIER_RULES, type TierRule, type TierSource } from '../config/tierRules';
import { TIERS, cellNumber, cellValues, findColumn, isTier, type Dataset, type Row, type Tier } from '../data/model';

/** The tier a study falls into when no rule matches. */
export const FALLBACK_TIER: Tier = 5;

/** What the catch-all rule is called when the app adds one of its own. */
export const FALLBACK_RULE_NAME = 'Everything else';

/** A rule matches when every condition has at least one of its values on the row. */
export function ruleMatches(row: Row, rule: TierRule): boolean {
  return rule.conditions.every((condition) => {
    if (condition.values.length === 0) return false;
    return cellValues(row, condition.key).some((value) => condition.values.includes(value));
  });
}

/**
 * Rules are evaluated in order; the first match wins.
 *
 * A rule with no conditions asks nothing of a study, so on its own terms every
 * study satisfies it - and the panel reaches that state in one click, by
 * deleting a rule's last condition or by naming a tier that never had one. A
 * rule in that state is skipped rather than allowed to sweep the whole batch
 * onto its ring; what no rule claims falls to the fallback tier, which is what
 * the empty catch-all `adaptRulesToDataset` appends stands for.
 */
export function tierFromRules(row: Row, rules: TierRule[]): Tier {
  const hit = rules.find((rule) => rule.conditions.length > 0 && ruleMatches(row, rule));
  return hit ? hit.tier : FALLBACK_TIER;
}

/** Read a tier straight from a numeric column (rounded and clamped to 1..5). */
export function tierFromColumn(row: Row, key: string | null): Tier | undefined {
  const raw = cellNumber(row, key);
  if (raw === undefined) return undefined;
  const clamped = Math.min(5, Math.max(1, Math.round(raw)));
  return isTier(clamped) ? clamped : undefined;
}

export function assignTier(row: Row, rules: TierRule[], source: TierSource, tierKey: string | null): Tier {
  if (source === 'column') return tierFromColumn(row, tierKey) ?? tierFromRules(row, rules);
  return tierFromRules(row, rules);
}

/**
 * Keep rules usable for a dataset: drop conditions whose column is missing,
 * drop values the column does not contain, drop rules left with nothing, and
 * make sure the list still ends with a catch-all.
 */
export function adaptRulesToDataset(rules: TierRule[], dataset: Dataset): TierRule[] {
  const adapted: TierRule[] = [];
  rules.forEach((rule, index) => {
    const isLast = index === rules.length - 1;
    const conditions = rule.conditions.flatMap((condition) => {
      const column = findColumn(dataset, condition.key);
      if (!column) return [];
      const values =
        column.values.length > 0 ? condition.values.filter((value) => column.values.includes(value)) : condition.values;
      return values.length > 0 ? [{ key: condition.key, values }] : [];
    });
    const lostEverything = rule.conditions.length > 0 && conditions.length === 0;
    if (lostEverything && !isLast) return;
    adapted.push({ ...rule, conditions: lostEverything ? [] : conditions });
  });
  if (!adapted.some((rule) => rule.conditions.length === 0)) {
    adapted.push({ tier: FALLBACK_TIER, name: FALLBACK_RULE_NAME, conditions: [] });
  }
  return adapted;
}

/**
 * Drop the values a condition names that its column no longer holds.
 *
 * Rules the user edited are stored, and a stored rule outlives the reading of
 * the batch it was written against: changing a column's rule in *Column rules*
 * cuts, splits or bands its cells and so rewrites its vocabulary. A condition
 * still naming the old spelling matches nothing, while the panel goes on
 * listing it as a condition that is set - the rule silently stops working and
 * its studies drop to the fallback ring with nothing on screen to say why.
 *
 * Unlike `adaptRulesToDataset`, which prepares the defaults for a file and may
 * drop a rule outright, this never removes a rule or a condition: it runs on
 * every read of rules the user built, where throwing their work away would be
 * worse than the staleness it fixes. What it leaves is only ever what the
 * column can still answer, so the panel and the orbit agree again.
 */
export function pruneRuleValues(rules: TierRule[], dataset: Dataset): TierRule[] {
  return rules.map((rule) => ({
    ...rule,
    conditions: rule.conditions.map((condition) => {
      const column = findColumn(dataset, condition.key);
      // A free-text column lists no values, so there is nothing to check
      // against - the same guard `adaptRulesToDataset` makes.
      if (!column || column.values.length === 0) return condition;
      const values = condition.values.filter((value) => column.values.includes(value));
      return values.length === condition.values.length ? condition : { ...condition, values };
    }),
  }));
}

export function defaultTierRulesFor(dataset: Dataset): TierRule[] {
  return adaptRulesToDataset(DEFAULT_TIER_RULES, dataset);
}

/** True when the rule list carries no real conditions (everything lands on the fallback ring). */
export function rulesAreEmpty(rules: TierRule[]): boolean {
  return rules.every((rule) => rule.conditions.length === 0);
}

/**
 * The name a rule was given, or '' when it has none. The panel used to call a
 * rule it created "Tier <n>", which only repeats the number of its ring, so a
 * rule still carrying that name counts as unnamed.
 */
export function tierName(rule: TierRule | undefined): string {
  const name = rule?.name.trim() ?? '';
  return name.toLowerCase() === 'tier ' + rule?.tier ? '' : name;
}

/**
 * Each ring named by the values it takes, when the rules sort one column into
 * rings: every rule that can place a study asks one thing of the same column,
 * and no value is named by two rings. A ring is then said in full by the
 * values that put a study on it ("A or B"), so the orbit can write those in
 * place of its number.
 *
 * A rule that asks nothing, or has a condition still waiting for a value,
 * places no study, so its ring is named '' without spoiling the rest - not
 * every ring has to be used, and a condition being set up is not yet a second
 * column. `null` when the rules read anything else: two columns, two
 * conditions on one rule, a value shared by two rings, or no rule in use.
 */
export function ringValueNames(rules: TierRule[]): Record<Tier, string> | null {
  const rings = Object.fromEntries(TIERS.map((tier) => [tier, [] as string[]])) as Record<Tier, string[]>;
  const placed = new Set<string>();
  let key: string | null = null;
  for (const rule of rules) {
    const { conditions } = rule;
    if (conditions.length === 0 || conditions.some((condition) => condition.values.length === 0)) continue;
    if (conditions.length > 1 || (key !== null && conditions[0].key !== key)) return null;
    key = conditions[0].key;
    for (const value of conditions[0].values) {
      if (rings[rule.tier].includes(value)) continue;
      if (placed.has(value)) return null;
      placed.add(value);
      rings[rule.tier].push(value);
    }
  }
  if (key === null) return null;
  return Object.fromEntries(TIERS.map((tier) => [tier, rings[tier].join(' or ')])) as Record<Tier, string>;
}
