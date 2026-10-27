import type { TierCondition, TierRule, TierSource } from '../../config/tierRules';
import { TIERS, type Dataset, type Tier } from '../../data/model';
import type { TierSettings } from '../../hooks/useStoredSetup';
import { tierColumnCandidates } from '../../lib/dataset';
import { cx } from '../../lib/cx';
import { prettyKey } from '../../lib/text';
import { FALLBACK_RULE_NAME, FALLBACK_TIER, ringValueNames, tierName } from '../../lib/tiers';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { Pills } from '../ui/Pills';
import { Section } from '../ui/Section';
import { Select } from '../ui/Select';
import styles from './TierPanel.module.css';

interface TierPanelProps {
  /**
   * Whose rings these are, when they are not the user's to set: ours, for the
   * example we ship, or the author's, on a site published from Lit Orbit.
   * Either way the panel only reports them.
   */
  locked: 'example' | 'site' | null;
  dataset: Dataset;
  tiers: TierSettings;
}

/**
 * Evidence tiers. Either read from a numeric column of the file, or derived
 * from an ordered list of rules (tier 1 checked first, first match wins;
 * anything unmatched lands on tier 5).
 *
 * Two batches are the exception, and the panel only reports their rings: the
 * built-in one, which records a study design for every study, and the batch of
 * a published site, whose rings its author set.
 */
export function TierPanel(props: TierPanelProps) {
  const { locked, dataset, tiers } = props;
  const { key: tierKey, source: tierSource, rules, counts: tierCounts } = tiers;
  const tierColumns = tierColumnCandidates(dataset);
  const categorical = dataset.columns.filter((column) => column.categorical);
  const usingColumn = tierSource === 'column' && tierKey !== null;

  const sourceOptions = [{ value: 'rules', label: 'Rules below' }];
  if (tierColumns.length > 0) sourceOptions.push({ value: 'column', label: 'A column of the file' });

  const ruleFor = (tier: Tier) => rules.find((rule) => rule.tier === tier);
  // What an unnamed ring is called on the orbit, shown where its name would go.
  const byValue = ringValueNames(rules);

  if (locked) {
    const description =
      locked === 'example'
        ? 'Tier 1 is the innermost ring. Our batch records how every study was designed, so which ring a study sits on is settled - load your own batch to set the rings yourself.'
        : usingColumn
          ? `Tier 1 is the innermost ring. Each study's ring is read from the column "${tierKey}".`
          : 'Tier 1 is the innermost ring. The author of this map set the rings: a study sits on the first one whose conditions it meets.';
    return (
      <Section title="Evidence tiers" description={description}>
        <div className={styles.rules}>
          {TIERS.map((tier) => {
            const count = tierCounts[tier];
            return (
              <article key={tier} className={styles.rule}>
                <header className={styles.ruleHeader}>
                  <span className={styles.tierBadge}>Tier {tier}</span>
                  <span className={styles.count}>
                    {count} {count === 1 ? 'study' : 'studies'}
                  </span>
                </header>
                {locked === 'example' ? (
                  <p className={styles.fixedName}>{ruleFor(tier)?.name ?? FALLBACK_RULE_NAME}</p>
                ) : (
                  !usingColumn && <RuleSummary tier={tier} rule={ruleFor(tier)} />
                )}
              </article>
            );
          })}
        </div>
      </Section>
    );
  }

  /** Replace (or insert) the rule for one tier, keeping the list in tier order. */
  const putRule = (tier: Tier, next: TierRule) => {
    const others = rules.filter((rule) => rule.tier !== tier);
    tiers.setRules([...others, next].sort((a, b) => a.tier - b.tier));
  };

  const updateConditions = (tier: Tier, conditions: TierCondition[]) => {
    const existing = ruleFor(tier);
    putRule(tier, { tier, name: existing?.name ?? '', conditions });
  };

  return (
    <Section
      title="Evidence tiers"
      action={
        <Button variant="ghost" size="sm" onClick={tiers.reset}>
          Reset
        </Button>
      }
      description="Tier 1 is the innermost ring. Rules are checked top-down; the first that matches wins."
    >
      <Field label="Tier source">
        <Select value={tierSource} onChange={(value) => tiers.setSource(value as TierSource)} options={sourceOptions} />
      </Field>
      {tierSource === 'column' && (
        <Field label="Tier column">
          <Select
            value={tierKey ?? ''}
            onChange={(value) => tiers.setKey(value || null)}
            options={tierColumns.map((column) => ({ value: column.key, label: column.key }))}
            placeholder="Choose a column…"
          />
        </Field>
      )}
      {usingColumn && <Notice>Tiers come from "{tierKey}". Rules below are ignored.</Notice>}

      <div className={cx(styles.rules, usingColumn && styles.rulesDisabled)}>
        {TIERS.map((tier) => {
          const rule = ruleFor(tier);
          const count = tierCounts[tier];
          return (
            <article key={tier} className={styles.rule}>
              <header className={styles.ruleHeader}>
                <span className={styles.tierBadge}>Tier {tier}</span>
                <span className={styles.count}>
                  {count} {count === 1 ? 'study' : 'studies'}
                </span>
              </header>
              {tier === FALLBACK_TIER ? (
                <FallbackNote />
              ) : (
                <>
                  <input
                    className={styles.nameInput}
                    value={tierName(rule) ? (rule?.name ?? '') : ''}
                    placeholder={byValue?.[tier] || 'Describe this tier'}
                    onChange={(event) =>
                      putRule(tier, { tier, name: event.target.value, conditions: rule?.conditions ?? [] })
                    }
                    aria-label={'Name of tier ' + tier}
                  />
                  {(rule?.conditions ?? []).map((condition, index) => (
                    <ConditionEditor
                      key={index}
                      condition={condition}
                      dataset={dataset}
                      onChange={(next) => {
                        const conditions = [...(rule?.conditions ?? [])];
                        conditions[index] = next;
                        updateConditions(tier, conditions);
                      }}
                      onRemove={() =>
                        updateConditions(
                          tier,
                          (rule?.conditions ?? []).filter((_, i) => i !== index),
                        )
                      }
                    />
                  ))}
                  {(rule?.conditions.length ?? 0) === 0 && (
                    <p className={styles.hint}>No conditions: this tier is unused.</p>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={categorical.length === 0}
                    onClick={() =>
                      updateConditions(tier, [...(rule?.conditions ?? []), { key: categorical[0].key, values: [] }])
                    }
                  >
                    + Add condition
                  </Button>
                </>
              )}
            </article>
          );
        })}
      </div>
    </Section>
  );
}

/** What the last ring holds, said the same way whether the rules are the user's to edit or not. */
function FallbackNote() {
  return <p className={styles.fallback}>Everything no rule above matched.</p>;
}

/**
 * One of an author's rules as a reader of their site sees it: what they called
 * the ring, and what it asks of a study. Said the way the editor would have
 * shown it to them - the last ring is where everything else lands, and a rule
 * missing a condition or a value matches nothing.
 */
function RuleSummary({ tier, rule }: { tier: Tier; rule: TierRule | undefined }) {
  if (tier === FALLBACK_TIER) return <FallbackNote />;
  const used =
    rule !== undefined &&
    rule.conditions.length > 0 &&
    rule.conditions.every((condition) => condition.values.length > 0);
  if (!used) return <p className={styles.hint}>Not used.</p>;
  const name = tierName(rule);
  return (
    <>
      {name && <p className={styles.fixedName}>{name}</p>}
      {rule.conditions.map((condition, index) => (
        <p key={index} className={styles.conditionSummary}>
          <span className={styles.conditionKey}>{prettyKey(condition.key)}:</span> {condition.values.join(', ')}
        </p>
      ))}
    </>
  );
}

interface ConditionEditorProps {
  condition: TierCondition;
  dataset: Dataset;
  onChange: (condition: TierCondition) => void;
  onRemove: () => void;
}

/** One "column is any of …" clause: a column picker plus toggleable value pills. */
function ConditionEditor({ condition, dataset, onChange, onRemove }: ConditionEditorProps) {
  const column = dataset.columns.find((c) => c.key === condition.key);
  const categorical = dataset.columns.filter((c) => c.categorical);
  const toggle = (value: string) => {
    const values = condition.values.includes(value)
      ? condition.values.filter((v) => v !== value)
      : [...condition.values, value];
    onChange({ ...condition, values });
  };
  return (
    <div className={styles.condition}>
      <div className={styles.conditionHeader}>
        <Select
          value={condition.key}
          onChange={(key) => onChange({ key, values: [] })}
          options={categorical.map((c) => ({ value: c.key, label: prettyKey(c.key) }))}
          aria-label="Condition column"
        />
        <button type="button" className={styles.remove} onClick={onRemove} aria-label="Remove condition">
          ×
        </button>
      </div>
      <Pills
        values={column?.values ?? []}
        selected={condition.values}
        onToggle={toggle}
        legend={prettyKey(condition.key)}
      />
      {condition.values.length === 0 && <p className={styles.hint}>Pick at least one value.</p>}
    </div>
  );
}
