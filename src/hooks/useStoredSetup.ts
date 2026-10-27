import { useMemo } from 'react';
import { DEFAULT_COURSE_NAME } from '../config/defaults';
import type { TierRule, TierSource } from '../config/tierRules';
import {
  findColumn,
  TIERS,
  type ColumnMapping,
  type ColumnRule,
  type ColumnRules,
  type DataMode,
  type Dataset,
  type Tier,
} from '../data/model';
import type { Preset } from '../data/preset';
import { columnRuleChoices, type ColumnRuleChoice } from '../lib/columnRules';
import {
  defaultFilterKeys,
  guessMapping,
  orbitRoleKeys,
  readDataset,
  sanitiseMapping,
  studiesFrom,
} from '../lib/dataset';
import type { KeptImport } from '../lib/importStore';
import { computeOrbitModel, type OrbitModel } from '../lib/layout';
import type { FilterState } from '../lib/matching';
import { siteBatch, type PublishDraft, type SiteConfig } from '../lib/site';
import { clearStoredData, storageKey } from '../lib/storage';
import { defaultTierRulesFor, pruneRuleValues, rulesAreEmpty } from '../lib/tiers';
import { useLocalStorageState } from './useLocalStorageState';

/** Which column plays which role in the orbit, and how each column's cells are read. */
export interface ColumnSetup {
  mapping: ColumnMapping;
  rules: ColumnRules;
  /** Every column with the rules it could be read under, for the dropdowns. */
  choices: ColumnRuleChoice[];
  setMapping: (mapping: ColumnMapping) => void;
  changeRule: (key: string, rule: ColumnRule) => void;
}

/** "Your course": the settings the studies are matched on. */
export interface CourseSettings {
  /** The columns the panel shows, in order. */
  keys: string[];
  /**
   * The values chosen per column; an empty list reads as "any". Only the
   * columns on show, and only values their columns still hold - see the hook
   * for why both are dropped here rather than in storage.
   */
  filters: FilterState;
  /** Replace every setting at once, as a link does. */
  setFilters: (filters: FilterState) => void;
  /** A click on a value adds it or takes it away. */
  toggleValue: (key: string, value: string) => void;
  /** Unpick one setting's values; the row stays, so it reads as "any" again. */
  clearKey: (key: string) => void;
  clear: () => void;
  addKey: (key: string) => void;
  removeKey: (key: string) => void;
}

/** How the rings are decided: from a column of the file, or from rules. */
export interface TierSettings {
  source: TierSource;
  /** The column the rings are read from, when `source` is 'column'. */
  key: string | null;
  rules: TierRule[];
  /** Studies per ring under the current settings, for feedback. */
  counts: Record<Tier, number>;
  setSource: (source: TierSource) => void;
  setKey: (key: string | null) => void;
  setRules: (rules: TierRule[]) => void;
  /** Back to the rules the batch started with. */
  reset: () => void;
}

/**
 * Everything the app keeps about the batch and the course, and what follows
 * from it: the batch as the screen reads it, the orbit drawn from it, and the
 * ways to change each part. The nearest thing here to a Vue store, handed to
 * the screens as a prop.
 */
export interface StoredSetup {
  /** The batch chosen on the landing page; `null` before any was. */
  dataMode: DataMode | null;
  /**
   * The batch was chosen, kept its choice, and is not there.
   *
   * Only one stored key is ever big enough to be refused: the batch itself.
   * When it is, the small keys beside it still persist, so the next load comes
   * back saying "own batch" with no batch to show - and falling through to the
   * built-in one would put the user in front of other people's studies under
   * their own settings, with no *Load another file* button, and nothing said.
   */
  batchLost: boolean;
  /** The last write of the batch was refused for want of room. */
  batchTooBig: boolean;
  /** The batch as the file wrote it. */
  batch: Dataset;
  /** The same batch with every column read under its rule: what the screen shows. */
  dataset: Dataset;
  columns: ColumnSetup;
  course: CourseSettings;
  tiers: TierSettings;
  /** Every study placed, matched and coloured. */
  model: OrbitModel;
  /** The user's course, as typed. */
  courseName: string;
  setCourseName: (name: string) => void;
  /** What is written at the centre of the orbit. */
  centreLabel: string;
  /** What the user wrote about their map when they last published it. */
  publishDraft: PublishDraft | null;
  setPublishDraft: (draft: PublishDraft | null) => void;
  /**
   * Open a new batch - a file's, or `null` for the example - and forget every
   * choice made about the last one. The course name and the publish draft
   * stay: they are about the user's course and map, not about the file.
   */
  startBatch: (batch: Dataset | null) => void;
  /**
   * Open the batch of a published site with every choice its author made,
   * and what they wrote about the map, so publishing again starts from there.
   */
  takeUpSite: (config: SiteConfig) => void;
  /**
   * Forget everything this browser kept, back to no batch chosen. Call it
   * after `startBatch(null)`, not before: every setter writes as it is
   * called, so clearing first would leave the resets behind in storage.
   */
  forget: () => void;
}

/**
 * The stored setup, and the derived values that follow from it (like Vue
 * `computed`: recomputed only when their inputs change).
 *
 * `null` in a stored slot means "not customised yet - derive the default
 * from the current batch". A published site has nothing stored about its
 * batch, whatever this browser holds: it is read exactly as its author left
 * it, and all a visitor changes are the settings of their own course.
 *
 * `linkedFilters` is the course the page was opened on, when its address
 * names one, and beats what this browser remembers; `kept` is the batch read
 * again from the kept file when storage had lost it.
 */
export function useStoredSetup({
  preset,
  published,
  kept,
  linkedFilters,
}: {
  preset: Preset;
  published: boolean;
  kept: KeptImport | null;
  linkedFilters: FilterState;
}): StoredSetup {
  // A published site has one batch and no way to another.
  const [storedDataMode, setDataMode] = useLocalStorageState<DataMode | null>(storageKey('dataMode'), null);
  const dataMode: DataMode | null = published ? 'base' : storedDataMode;
  // The batch is far and away the largest thing kept here, and the only one
  // that can be refused for want of room. When it was, and the file was kept,
  // `kept.batch` is the batch read from the file again, and stands in for the
  // stored one; when it was not, see `batchLost` for what that costs if it
  // goes unsaid.
  const [storedDataset, setStoredDataset, batchTooBig] = useLocalStorageState<Dataset | null>(
    storageKey('dataset'),
    null,
    kept?.batch ?? undefined,
  );
  const [storedMapping, setStoredMapping] = useLocalStorageState<ColumnMapping | null>(storageKey('mapping'), null);
  const [storedColumnRules, setStoredColumnRules] = useLocalStorageState<ColumnRules | null>(
    storageKey('columnRules'),
    null,
  );
  const [storedFilterKeys, setStoredFilterKeys] = useLocalStorageState<string[] | null>(storageKey('filterKeys'), null);
  const [storedFilters, setStoredFilters] = useLocalStorageState<FilterState>(
    storageKey('filters'),
    {},
    Object.keys(linkedFilters).length > 0 ? linkedFilters : undefined,
  );
  const [storedTierRules, setStoredTierRules] = useLocalStorageState<TierRule[] | null>(storageKey('tierRules'), null);
  const [storedTierSource, setStoredTierSource] = useLocalStorageState<TierSource | null>(
    storageKey('tierSource'),
    null,
  );
  // The user's course, not their file: a new batch keeps it.
  const [courseName, setCourseName] = useLocalStorageState<string>(storageKey('courseName'), '');
  // Kept like the course name: it is about the map, so a new version of the batch keeps it.
  const [publishDraft, setPublishDraft] = useLocalStorageState<PublishDraft | null>(storageKey('publish'), null);

  /** What the user has changed about the batch and how it is read: nothing, on a published site. */
  const custom = published
    ? { dataset: null, columnRules: null, mapping: null, tierRules: null, tierSource: null }
    : {
        dataset: storedDataset,
        columnRules: storedColumnRules,
        mapping: storedMapping,
        tierRules: storedTierRules,
        tierSource: storedTierSource,
      };

  // The batch as the file wrote it, then the same batch with every column
  // read under its rule - changing a rule re-reads it without the file being
  // loaded again.
  const batch = custom.dataset ?? preset.batch;
  const columnRules = useMemo(() => ({ ...batch.rules, ...(custom.columnRules ?? {}) }), [batch, custom.columnRules]);
  const dataset = useMemo(() => readDataset(batch, columnRules), [batch, columnRules]);
  const ruleChoices = useMemo(() => columnRuleChoices(batch), [batch]);
  // The batch that came set up gets the roles and filters it came with; a file
  // the user loaded gets guesses. Both are sanitised, so a batch whose columns
  // changed leaves the roles it no longer has empty rather than dangling.
  const mapping = useMemo(() => {
    const fallback = dataset.source === 'base' ? preset.mapping : guessMapping(dataset);
    return sanitiseMapping(custom.mapping ?? fallback, dataset);
  }, [custom.mapping, dataset, preset.mapping]);
  /**
   * Which filters the panel starts with, before the user edits the list.
   *
   * Read off the roles the batch was *guessed* with rather than the roles it
   * currently has, so it does not move underfoot: derived from the live
   * mapping, giving a column a role would not only hide its row but promote
   * the next filterable column into the panel to fill the gap, and taking the
   * role away again would then remove that promoted row along with whatever
   * had been chosen in it.
   */
  const defaultKeys = useMemo(
    () => (dataset.source === 'base' ? preset.filterKeys : defaultFilterKeys(dataset, guessMapping(dataset))),
    [dataset, preset.filterKeys],
  );
  /**
   * The list as the user left it; what the panel shows is this, minus what is
   * hidden.
   *
   * A setting with values chosen is a setting of the course whether or not its
   * row was added to the panel by hand, so its column joins the list. Nothing
   * the panel does can leave values on a column outside the list - taking a
   * row away takes its values with it - but a link can name any column of the
   * batch, and the setting it names has to be seen to be set.
   */
  const chosenFilterKeys = useMemo(() => {
    const chosen = storedFilterKeys ?? defaultKeys;
    const set = Object.keys(storedFilters).filter((key) => storedFilters[key].length > 0 && !chosen.includes(key));
    return set.length === 0 ? chosen : [...chosen, ...set];
  }, [storedFilterKeys, defaultKeys, storedFilters]);
  // A column given a role in the orbit leaves "Your course" with it: the
  // wedge, the colour, the dot size and the ring are read off the picture, so
  // asking for them again as a setting of the course would say nothing new.
  const filterKeys = useMemo(() => {
    const taken = orbitRoleKeys(mapping);
    return chosenFilterKeys.filter((key) => findColumn(dataset, key) !== undefined && !taken.has(key));
  }, [chosenFilterKeys, dataset, mapping]);
  /**
   * Only the settings on show count toward a match, and only the values the
   * column can still answer with.
   *
   * A filter whose column has just been made a wedge has to stop inking
   * studies the moment it leaves the panel, or the orbit would answer to a
   * setting nobody can see. The same goes for a value: changing a column's
   * rule rewrites its vocabulary, and a value chosen under the old reading
   * would otherwise stay counted as a setting that no study on earth can meet,
   * with no pill lit to say which one it is.
   *
   * Both are dropped here rather than in storage, so taking the role away, or
   * putting the rule back, brings the setting back as it was.
   */
  const filters = useMemo(
    () =>
      Object.fromEntries(
        filterKeys.map((key) => {
          const values = findColumn(dataset, key)?.values ?? [];
          return [key, (storedFilters[key] ?? []).filter((value) => values.includes(value))];
        }),
      ),
    [filterKeys, storedFilters, dataset],
  );
  /**
   * Stored rules are pruned on every read for the same reason the filters are:
   * a condition naming a value its column lost to a rule change matches
   * nothing, while the panel goes on showing it as set.
   *
   * The rules a batch came set up with are pruned the same way and never
   * adapted: on a published site they are the author's, and adapting would
   * drop a condition with no values left - which matches nothing - and so let
   * the rest of its rule claim studies the author never saw it claim.
   */
  const tierRules = useMemo(() => {
    if (custom.tierRules) return pruneRuleValues(custom.tierRules, dataset);
    return dataset.source === 'base' ? pruneRuleValues(preset.tierRules, dataset) : defaultTierRulesFor(dataset);
  }, [custom.tierRules, dataset, preset.tierRules]);
  const tierSource: TierSource = useMemo(() => {
    if (custom.tierSource) return custom.tierSource;
    if (dataset.source === 'base') return preset.tierSource;
    return rulesAreEmpty(tierRules) && mapping.tierKey ? 'column' : 'rules';
  }, [custom.tierSource, dataset.source, preset.tierSource, tierRules, mapping.tierKey]);

  const studies = useMemo(() => studiesFrom(dataset, mapping), [dataset, mapping]);
  const model = useMemo(
    () => computeOrbitModel({ dataset, studies, mapping, filters, tierRules, tierSource }),
    [dataset, studies, mapping, filters, tierRules, tierSource],
  );
  const tierCounts = useMemo(() => {
    const counts = Object.fromEntries(TIERS.map((tier) => [tier, 0])) as Record<Tier, number>;
    for (const node of model.nodes) counts[node.tier] += 1;
    return counts;
  }, [model]);
  // A course the user named is theirs to see at the centre, and on a published
  // site the course its author named; the example, and a course left unnamed,
  // show the default. The filters never change it: they move the dots, not the
  // name of the course.
  const namedCourse = (dataset.source === 'file' ? courseName : preset.courseName).trim();
  const centreLabel = namedCourse || DEFAULT_COURSE_NAME;

  // ---- Changing it.
  const startBatch = (next: Dataset | null) => {
    setStoredDataset(next);
    setStoredMapping(null);
    setStoredColumnRules(null);
    setStoredFilterKeys(null);
    setStoredFilters({});
    setStoredTierRules(null);
    setStoredTierSource(null);
    setDataMode(next === null ? 'base' : 'own');
  };

  const takeUpSite = (config: SiteConfig) => {
    startBatch(siteBatch(config, 'file'));
    setStoredColumnRules(config.columnRules);
    setStoredMapping(config.mapping);
    setStoredFilterKeys(config.filterKeys);
    setStoredTierRules(config.tierRules);
    setStoredTierSource(config.tierSource);
    setCourseName(config.courseName);
    setPublishDraft({
      title: config.title,
      description: config.description,
      citation: config.paper.citation,
      paperUrl: config.paper.url,
    });
  };

  const forget = () => {
    setDataMode(null);
    clearStoredData();
  };

  // Written against the list as the user left it, never against the filtered
  // one on screen: a row hidden because its column has an orbit role is still
  // one of their settings, and writing the visible list back would drop it for
  // good the next time any other filter was touched.
  const addKey = (key: string) =>
    setStoredFilterKeys(chosenFilterKeys.includes(key) ? chosenFilterKeys : [...chosenFilterKeys, key]);
  const removeKey = (key: string) => {
    setStoredFilterKeys(chosenFilterKeys.filter((k) => k !== key));
    const next = { ...storedFilters };
    delete next[key];
    setStoredFilters(next);
  };
  const toggleValue = (key: string, value: string) => {
    const chosen = storedFilters[key] ?? [];
    const next = chosen.includes(value) ? chosen.filter((other) => other !== value) : [...chosen, value];
    setStoredFilters({ ...storedFilters, [key]: next });
  };

  return {
    dataMode,
    batchLost: dataMode === 'own' && storedDataset === null,
    batchTooBig,
    batch,
    dataset,
    columns: {
      mapping,
      rules: columnRules,
      choices: ruleChoices,
      setMapping: setStoredMapping,
      changeRule: (key, rule) => setStoredColumnRules({ ...(storedColumnRules ?? {}), [key]: rule }),
    },
    course: {
      keys: filterKeys,
      filters,
      setFilters: setStoredFilters,
      toggleValue,
      clearKey: (key) => setStoredFilters({ ...storedFilters, [key]: [] }),
      clear: () => setStoredFilters({}),
      addKey,
      removeKey,
    },
    tiers: {
      source: tierSource,
      key: mapping.tierKey,
      rules: tierRules,
      counts: tierCounts,
      setSource: setStoredTierSource,
      setKey: (key) => setStoredMapping({ ...mapping, tierKey: key }),
      setRules: setStoredTierRules,
      reset: () => setStoredTierRules(null),
    },
    model,
    courseName,
    setCourseName,
    centreLabel,
    publishDraft,
    setPublishDraft,
    startBatch,
    takeUpSite,
    forget,
  };
}
