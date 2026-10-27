import { describe, expect, it } from 'vitest';
import { BAND_COUNT_CHOICES, BAND_MIN_DISTINCT } from '../config/defaults';
import type { CellValue, ColumnMapping, ColumnRule, Dataset } from '../data/model';
import { detectDelimiter, ruleKey, ruleOptions, WHOLE } from './columnRules';
import {
  buildDataset,
  colourColumnCandidates,
  defaultFilterKeys,
  filterableColumns,
  filterColumnCandidates,
  filterMaxCategories,
  normaliseCell,
  readDataset,
  sanitiseMapping,
  sizeColumnCandidates,
  wedgeColumnCandidates,
} from './dataset';
import type { RawRow } from './parse';

/**
 * These check the second half of loading a file: how a column of cells is
 * read once the whole column can be seen. The data is invented.
 */

/** A batch read under the rules detection chose for it, as the app does. */
const build = (rows: RawRow[]): Dataset => {
  const batch = buildDataset('test', rows, 'file');
  return readDataset(batch, batch.rules);
};

/** The same batch read under a rule of our own for one column. */
const readWith = (rows: RawRow[], key: string, rule: Partial<ColumnRule>): Dataset => {
  const batch = buildDataset('test', rows, 'file');
  return readDataset(batch, { ...batch.rules, [key]: { ...WHOLE, ...rule } });
};
const column = (dataset: Dataset, key: string) => dataset.columns.find((info) => info.key === key);
const cells = (dataset: Dataset, key: string) => dataset.rows.map((row) => row[key]);

describe('reading one cell', () => {
  it('keeps leading zeros by leaving the value as text', () => {
    expect(normaliseCell('007')).toBe('007');
    expect(normaliseCell('0')).toBe(0);
    expect(normaliseCell('0.5')).toBe(0.5);
  });

  it('keeps a long identifier exact by leaving it as text', () => {
    expect(normaliseCell('9780306406157')).toBe(9780306406157);
    expect(normaliseCell('97803064061570000')).toBe('97803064061570000');
  });

  it('reads ordinary numbers as numbers', () => {
    expect(normaliseCell('2019')).toBe(2019);
    expect(normaliseCell(' -12.5 ')).toBe(-12.5);
  });

  it('writes a date out as a date', () => {
    expect(normaliseCell(new Date(2024, 0, 15))).toBe('2024-01-15');
    expect(normaliseCell(new Date(2024, 0, 15, 9, 30))).toBe('2024-01-15 09:30');
  });

  it('treats blanks of every kind as empty', () => {
    expect(normaliseCell('   ')).toBeNull();
    expect(normaliseCell(null)).toBeNull();
    expect(normaliseCell(undefined)).toBeNull();
    expect(normaliseCell(Number.NaN)).toBeNull();
  });
});

describe('finding the list separator', () => {
  const tags = (...values: string[]) => values.map((value) => value as unknown as string);

  it('splits a column of tags on a semicolon', () => {
    expect(detectDelimiter(tags('Coding; Debugging', 'Debugging', 'Coding; Writing', 'Writing; Coding'))).toBe(';');
  });

  it('splits a column of tags on a pipe', () => {
    expect(detectDelimiter(tags('Coding|Debugging', 'Debugging', 'Coding|Writing', 'Writing|Coding'))).toBe('|');
  });

  it('leaves titles alone even when most of them contain a semicolon', () => {
    expect(
      detectDelimiter(
        tags(
          'Alpha effects; a trial',
          'Beta outcomes; a review',
          'Gamma uptake; a survey',
          'Delta results; a study',
          'Epsilon use; a report',
          'Zeta change; an audit',
        ),
      ),
    ).toBeNull();
  });

  it('leaves a date column alone rather than splitting on the slash', () => {
    expect(detectDelimiter(tags('2024/01/15', '2024/02/20', '2023/11/02', '2024/01/15'))).toBeNull();
  });

  it('leaves a thousands separator alone', () => {
    expect(detectDelimiter(tags('1,200', '3,400', '1,200', '900'))).toBeNull();
  });

  it('leaves an author list alone when every name is different', () => {
    expect(
      detectDelimiter(tags('Ahmed, R.', 'Bianchi, L.', 'Chen, W.', 'Dubois, M.', 'Eriksson, K.', 'Fontaine, P.')),
    ).toBeNull();
  });

  it('leaves a phrase alone when splitting it would only add values', () => {
    // The comma is inside each design, not between two of them: splitting
    // trades four whole values for five fragments.
    expect(
      detectDelimiter(
        tags(
          '2+ Conditions, Random Assignment',
          '2+ Conditions, Non-random Assignment',
          '2+ Conditions, Random Assignment',
          'Single Group Design',
          '2+ Conditions, Non-random Assignment',
          'Single Group Design with Within-Subject Conditions',
        ),
      ),
    ).toBeNull();
  });

  it('does not guess the word "and" from the one cell that uses it', () => {
    expect(
      detectDelimiter(
        tags(
          '100 (Freshman)',
          '200 (Sophomore)',
          '300 (Junior) and 400 (Senior)',
          '400 (Senior)',
          'Mixed',
          'Not Reported',
        ),
      ),
    ).toBeNull();
  });

  it('splits a keyword column on a comma when the words repeat', () => {
    expect(
      detectDelimiter(tags('policy, equity', 'equity, access', 'access, policy', 'policy, access', 'equity, policy')),
    ).toBe(',');
  });
});

describe('building a dataset', () => {
  it('splits one column and leaves another intact in the same file', () => {
    const dataset = build([
      { Title: 'Alpha effects; a trial', Tags: 'Coding; Debugging' },
      { Title: 'Beta outcomes; a review', Tags: 'Debugging' },
      { Title: 'Gamma uptake; a survey', Tags: 'Coding; Writing' },
      { Title: 'Delta results; a study', Tags: 'Writing; Coding' },
      { Title: 'Epsilon use; a report', Tags: 'Coding' },
      { Title: 'Zeta change; an audit', Tags: 'Writing' },
    ]);
    expect(cells(dataset, 'Title')[0]).toBe('Alpha effects; a trial');
    expect(cells(dataset, 'Tags')[0]).toEqual(['Coding', 'Debugging']);
    expect(column(dataset, 'Tags')?.multi).toBe(true);
    expect(column(dataset, 'Tags')?.values).toEqual(['Coding', 'Debugging', 'Writing']);
  });

  it('treats spellings that differ only in case or spacing as one value', () => {
    const dataset = build([
      { Design: 'RCT' },
      { Design: 'rct' },
      { Design: 'RCT ' },
      { Design: 'Cohort  study' },
      { Design: 'cohort study' },
    ]);
    expect(column(dataset, 'Design')?.values).toEqual(['Cohort study', 'RCT']);
    expect(cells(dataset, 'Design')).toEqual(['RCT', 'RCT', 'RCT', 'Cohort study', 'Cohort study']);
  });

  it('picks the spelling used most often as the one to show', () => {
    const dataset = build([{ Design: 'rct' }, { Design: 'rct' }, { Design: 'RCT' }]);
    expect(column(dataset, 'Design')?.values).toEqual(['rct']);
  });

  it('does not merge spellings in a free text column', () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({ Title: `Study number ${index}` }));
    rows.push({ Title: 'STUDY NUMBER 0' });
    const dataset = build(rows);
    expect(cells(dataset, 'Title').at(-1)).toBe('STUDY NUMBER 0');
  });

  it('drops a column that is empty in every row', () => {
    const dataset = build([
      { Title: 'Alpha', Notes: '' },
      { Title: 'Beta', Notes: null },
    ]);
    expect(dataset.columns.map((info) => info.key)).toEqual(['Title']);
  });

  it('gives every row every key even when the file is ragged', () => {
    const dataset = build([{ Title: 'Alpha' }, { Title: 'Beta', Year: 2021 }]);
    expect(dataset.rows[0]).toEqual({ Title: 'Alpha', Year: null });
    expect(column(dataset, 'Year')?.filled).toBe(1);
  });

  it('describes a numeric column with its range', () => {
    const dataset = build([{ N: 12 }, { N: 4 }, { N: 87 }]);
    const info = column(dataset, 'N');
    expect(info?.numeric).toBe(true);
    expect([info?.min, info?.max]).toEqual([4, 87]);
  });

  it('does not treat an identifier column as numeric', () => {
    const dataset = build([{ Ref: '001' }, { Ref: '002' }, { Ref: '010' }]);
    expect(column(dataset, 'Ref')?.numeric).toBe(false);
    expect(column(dataset, 'Ref')?.unique).toBe(true);
  });

  it('reads a column of counts as a scale despite a cell that is not a count', () => {
    const dataset = build([{ N: 12 }, { N: 4 }, { N: 87 }, { N: 50 }, { N: 'Not Reported' }]);
    const info = column(dataset, 'N');
    expect(info?.numeric).toBe(true);
    // The ends of the scale are the ends of the counts, and the cell that is
    // not one sorts after them rather than into them.
    expect([info?.min, info?.max]).toEqual([4, 87]);
    expect(info?.values).toEqual(['4', '12', '50', '87', 'Not Reported']);
  });

  it('does not read a column as a scale when too little of it is numbers', () => {
    const dataset = build([{ N: 12 }, { N: 'Not Reported' }, { N: 'Not Reported' }]);
    expect(column(dataset, 'N')?.numeric).toBe(false);
  });

  it('keeps a list that arrived as a JSON array', () => {
    const dataset = build([{ Tags: ['Coding', 'Writing'] }, { Tags: ['Coding'] }]);
    expect(cells(dataset, 'Tags')).toEqual([['Coding', 'Writing'], 'Coding']);
    expect(column(dataset, 'Tags')?.multi).toBe(true);
  });
});

describe('choosing filters', () => {
  /** `rows` rows, one column with `count` values cycling through them. */
  const cycling = (key: string, count: number, rows = 20): RawRow[] =>
    Array.from({ length: rows }, (_, index) => ({ [key]: key + ' ' + (index % count) }));

  const merge = (left: RawRow[], right: RawRow[]): RawRow[] => left.map((row, index) => ({ ...row, ...right[index] }));

  /** A mapping with nothing but the roles named here. */
  const rolesOf = (roles: Partial<ColumnMapping> = {}): ColumnMapping => ({
    labelKey: null,
    wedgeKey: null,
    colourKey: null,
    sizeKey: null,
    tierKey: null,
    ...roles,
  });

  /**
   * Sixty rows: enough that a column one value past the limit still repeats
   * its values often enough to be a category (`CATEGORICAL_MAX_RATIO`), so it
   * is the limit that leaves it out, not the column being free text.
   */
  const ROWS = 60;

  it('offers a column with few enough values and leaves a longer one out', () => {
    const limit = filterMaxCategories(ROWS);
    const dataset = build(merge(cycling('Short', limit, ROWS), cycling('Long', limit + 1, ROWS)));
    expect(filterableColumns(dataset).map((column) => column.key)).toEqual(['Short']);
  });

  it('lets a filter grow with the batch, to 15% of its rows, between 30 and 40 values', () => {
    expect(filterMaxCategories(20)).toBe(30);
    expect(filterMaxCategories(100)).toBe(30);
    expect(filterMaxCategories(206)).toBe(30);
    expect(filterMaxCategories(207)).toBe(31);
    expect(filterMaxCategories(266)).toBe(39);
    expect(filterMaxCategories(267)).toBe(40);
    expect(filterMaxCategories(5000)).toBe(40);

    const keys = (rows: number, short: number) => {
      const dataset = build(merge(cycling('Short', short, rows), cycling('Long', short + 1, rows)));
      return filterableColumns(dataset).map((column) => column.key);
    };
    expect(keys(100, 30)).toEqual(['Short']);
    expect(keys(220, 33)).toEqual(['Short']);
    // At the top the limit meets `CATEGORICAL_MAX_DISTINCT`, which a filter's column keeps to anyway.
    expect(keys(1000, 40)).toEqual(['Short']);
  });

  it('starts on filterable columns only', () => {
    const limit = filterMaxCategories(ROWS);
    const dataset = build(merge(cycling('Long', limit + 1, ROWS), cycling('Course level', limit, ROWS)));
    expect(defaultFilterKeys(dataset, rolesOf())).toEqual(['Course level']);
  });

  it('stops offering a column once the orbit is drawn by it', () => {
    const dataset = build(merge(cycling('Course level', 3), cycling('Role', 3)));
    const keys = (mapping: ColumnMapping) => filterColumnCandidates(dataset, mapping).map((c) => c.key);

    expect(keys(rolesOf())).toEqual(['Course level', 'Role']);
    expect(keys(rolesOf({ wedgeKey: 'Role' }))).toEqual(['Course level']);
    expect(keys(rolesOf({ colourKey: 'Role' }))).toEqual(['Course level']);
    expect(keys(rolesOf({ sizeKey: 'Role' }))).toEqual(['Course level']);
    expect(keys(rolesOf({ tierKey: 'Role' }))).toEqual(['Course level']);
    expect(defaultFilterKeys(dataset, rolesOf({ wedgeKey: 'Role' }))).toEqual(['Course level']);
  });
});

describe('choosing what a study is placed by', () => {
  /**
   * Two categorical columns, one of which holds two values per cell. The
   * pairs repeat in six combinations of three values, so splitting the column
   * leaves it with fewer values than it started with - which is what makes
   * detection read it as a list rather than as six long answers.
   */
  const pairs = ['A; B', 'B; C', 'C; A', 'A; C', 'B; A', 'C; B'];
  const rows: RawRow[] = Array.from({ length: 12 }, (_, index) => ({
    Role: 'Role ' + (index % 3),
    Outcomes: pairs[index % 6],
  }));
  const mappingWedgedBy = (key: string | null): ColumnMapping => ({
    labelKey: null,
    wedgeKey: key,
    colourKey: null,
    sizeKey: null,
    tierKey: null,
  });

  it('offers only columns with one value per row as wedges', () => {
    const dataset = build(rows);
    expect(column(dataset, 'Outcomes')?.multi).toBe(true);
    expect(wedgeColumnCandidates(dataset).map((info) => info.key)).toEqual(['Role']);
  });

  it('empties the dot size role when its column is re-read as bands', () => {
    const counts: RawRow[] = [{ N: 12 }, { N: 4 }, { N: 87 }, { N: 50 }, { N: 'Not Reported' }];
    const sizedByN = { ...mappingWedgedBy(null), sizeKey: 'N' };
    expect(sizeColumnCandidates(build(counts)).map((info) => info.key)).toEqual(['N']);
    expect(sanitiseMapping(sizedByN, build(counts)).sizeKey).toBe('N');
    // Banded, the counts are written "4-31.7" and there is no scale left.
    const banded = readWith(counts, 'N', { bands: 3 });
    expect(sizeColumnCandidates(banded)).toEqual([]);
    expect(sanitiseMapping(sizedByN, banded).sizeKey).toBe(null);
  });

  it('empties the wedge role when its column is re-read as a list', () => {
    const whole = readWith(rows, 'Outcomes', WHOLE);
    expect(sanitiseMapping(mappingWedgedBy('Outcomes'), whole).wedgeKey).toBe('Outcomes');
    const split = readWith(rows, 'Outcomes', { split: ';' });
    expect(sanitiseMapping(mappingWedgedBy('Outcomes'), split).wedgeKey).toBe(null);
  });

  /**
   * The palette runs out at `COLOUR_MAX_CATEGORIES`. A column that is inside
   * it when the role is given and outside it after a rule change used to keep
   * the role, which painted most of the batch the one overflow colour under a
   * legend as long as the column, while the "Colour by" select - which offers
   * only columns inside the limit - showed "Single colour".
   */
  it('empties the colour role when its column is re-read into more values than the palette holds', () => {
    // Three answers, each written with one of four notes: twelve values whole,
    // three once the note is cut off.
    const directions = ['Positive', 'Negative', 'Mixed'];
    const notes = ['on grades', 'on confidence', 'on time spent', 'on engagement'];
    const answers: RawRow[] = Array.from({ length: 24 }, (_, index) => ({
      Direction: directions[index % 3] + ' — ' + notes[index % 4],
    }));
    const colouredBy = { ...mappingWedgedBy(null), colourKey: 'Direction' };
    const cut = readWith(answers, 'Direction', { prefix: 'dash' });
    expect(column(cut, 'Direction')?.values).toHaveLength(3);
    expect(colourColumnCandidates(cut).map((info) => info.key)).toEqual(['Direction']);
    expect(sanitiseMapping(colouredBy, cut).colourKey).toBe('Direction');
    // Read whole it is twelve values, and there are eight colours.
    const whole = readWith(answers, 'Direction', WHOLE);
    expect(column(whole, 'Direction')?.values).toHaveLength(12);
    expect(colourColumnCandidates(whole)).toEqual([]);
    expect(sanitiseMapping(colouredBy, whole).colourKey).toBe(null);
  });
});

describe('reading a column under a rule', () => {
  const answers = [
    { Trained: 'Yes — a 20 minute briefing before the first session' },
    { Trained: 'No' },
    { Trained: 'Yes — students were walked through two worked prompts' },
    { Trained: 'Not Reported' },
  ];

  it('keeps only the answer when a column is cut at a dash', () => {
    const dataset = readWith(answers, 'Trained', { prefix: 'dash' });
    expect(column(dataset, 'Trained')?.values).toEqual(['No', 'Not Reported', 'Yes']);
  });

  it('leaves the column whole without the rule', () => {
    expect(column(build(answers), 'Trained')?.values.length).toBe(4);
  });

  it('cuts every value of a cell that holds several', () => {
    const dataset = readWith(
      [
        { Measures: 'Learning\nOther — time on task' },
        { Measures: 'Learning\nSatisfaction' },
        { Measures: 'Other — dialogue moves' },
      ],
      'Measures',
      { split: '\n', prefix: 'dash' },
    );
    expect(cells(dataset, 'Measures')[0]).toEqual(['Learning', 'Other']);
    expect(column(dataset, 'Measures')?.values).toEqual(['Learning', 'Other', 'Satisfaction']);
  });

  it('counts a study that ran at two levels as both of them', () => {
    const rows = [{ Level: '100 (Freshman)' }, { Level: '300 (Junior) and 400 (Senior)' }, { Level: '400 (Senior)' }];
    const dataset = readWith(rows, 'Level', { split: ' and ' });
    expect(cells(dataset, 'Level')[1]).toEqual(['300 (Junior)', '400 (Senior)']);
    // The pair is gone as a value of its own, and 300 is now a value the
    // column has, so filtering on it reaches this study.
    expect(column(dataset, 'Level')?.values).toEqual(['100 (Freshman)', '300 (Junior)', '400 (Senior)']);
  });

  it('groups numbers into bands and leaves the rest of the column alone', () => {
    const rows = [{ Share: 10 }, { Share: 30 }, { Share: 65 }, { Share: 'Not Reported' }];
    const dataset = readWith(rows, 'Share', { bands: 5 });
    // 10..65 in five bands of 11: 10-21, 21-32, 32-43, 43-54, 54-65.
    expect(cells(dataset, 'Share')).toEqual(['10–21', '21–32', '54–65', 'Not Reported']);
  });

  it('orders bands by their numbers rather than as text', () => {
    const rows = [{ Share: 5 }, { Share: 50 }, { Share: 100 }, { Share: 150 }];
    expect(column(readWith(rows, 'Share', { bands: 4 }), 'Share')?.values).toEqual([
      '5–41.3',
      '41.3–77.5',
      '77.5–113.8',
      '113.8–150',
    ]);
  });

  it('puts the top of the range in the last band, not past it', () => {
    const rows = [{ Share: 0 }, { Share: 4 }, { Share: 10 }];
    expect(cells(readWith(rows, 'Share', { bands: 2 }), 'Share')).toEqual(['0–5', '0–5', '5–10']);
  });

  // Mean ages of ten samples: nine students around 20, and one sample of adults.
  const ages = [19, 20, 20, 21, 21, 22, 22, 23, 23, 45].map((Age) => ({ Age }));

  it('crowds most studies into one equal-width band when one number lies far off', () => {
    const values = column(readWith(ages, 'Age', { bands: 3 }), 'Age')?.values;
    // 19..45 in three stretches of 8.7: nine studies in the first, none in the second.
    expect(values).toEqual(['19–27.7', '36.3–45']);
  });

  it('cuts equal-count bands so that each holds about as many studies', () => {
    const dataset = readWith(ages, 'Age', { bands: 3, bandEdges: 'equalCount' });
    const bands = ['19–20', '21–22', '23–45'];
    expect(column(dataset, 'Age')?.values).toEqual(bands);
    // Three, four and three studies, where equal width put nine in one band.
    const read = cells(dataset, 'Age');
    expect(bands.map((band) => read.filter((cell) => cell === band).length)).toEqual([3, 4, 3]);
  });

  it('keeps equal numbers in one equal-count band, even when that leaves fewer bands', () => {
    const rows = [5, 100, 100, 100, 100, 100, 100, 100].map((Share) => ({ Share }));
    const values = column(readWith(rows, 'Share', { bands: 4, bandEdges: 'equalCount' }), 'Share')?.values;
    expect(values).toEqual(['5', '100']);
  });

  it('leaves the answers written in words alone when cutting equal-count bands', () => {
    const rows = [{ Share: 10 }, { Share: 'Not Reported' }, { Share: 30 }, { Share: 65 }, { Share: 80 }];
    expect(cells(readWith(rows, 'Share', { bands: 2, bandEdges: 'equalCount' }), 'Share')).toEqual([
      '10–30',
      'Not Reported',
      '10–30',
      '65–80',
      '65–80',
    ]);
  });
});

describe('offering a rule', () => {
  const offered = (cells: CellValue[]) => ruleOptions(cells).map(ruleKey);
  const rule = (split: string | null, prefix: 'dash' | 'colon' | null) => ruleKey({ split, prefix, bands: null });

  /**
   * One answer per line, and every loose end written out after a dash. Split
   * on the line break alone the column *grows* - each explanation becomes a
   * value of its own - so weighing that step by itself throws the reading
   * away before the cut it comes with has been seen.
   */
  const measures = [
    'Learning\nOther — time on task',
    'Learning\nSatisfaction',
    'Other — dialogue moves',
    'Satisfaction\nOther — time to first submission',
  ];

  it('offers a line split with the cut that makes it worth splitting', () => {
    expect(offered(measures)).toContain(rule('\n', 'dash'));
  });

  it('offers a separator most cells use, even where splitting on it alone adds values', () => {
    // Three of the four cells hold a line break, far past the share that makes it a candidate.
    expect(offered(measures)).toContain(rule('\n', null));
  });

  /** Twenty-five titles, all different; `holding` of them hold a comma, which only adds values when split on. */
  const titles = (holding: number) =>
    Array.from({ length: 25 }, (_, index) => (index < holding ? `Study ${index}, revisited` : `Study ${index}`));

  it('offers a separator in 8% of the cells or more, whatever splitting does', () => {
    // Two of twenty-five is 8%.
    expect(offered(titles(2))).toContain(rule(',', null));
  });

  it('leaves out a separator fewer cells use when splitting on it only adds values', () => {
    // One of twenty-five is 4%: too rare to offer on its own.
    expect(offered(titles(1))).not.toContain(rule(',', null));
  });

  it('still offers a separator that rare when splitting on it lowers the count', () => {
    // One study in twenty-five ran at two levels: "Junior and Senior" is two values the column already holds.
    const levels = Array.from({ length: 25 }, (_, index) =>
      index === 0 ? 'Junior and Senior' : index % 2 ? 'Junior' : 'Senior',
    );
    expect(offered(levels)).toContain(rule(' and ', null));
  });

  it('reads the offered rule as the values it promised', () => {
    const rows = measures.map((Measures) => ({ Measures }));
    const dataset = readWith(rows, 'Measures', { split: '\n', prefix: 'dash' });
    expect(column(dataset, 'Measures')?.values).toEqual(['Learning', 'Other', 'Satisfaction']);
  });

  const banded = (cells: CellValue[]) => ruleOptions(cells).filter((option) => option.bands !== null);

  it('offers no bands for a column of a few numbers, however many rows hold them', () => {
    const ratings = Array.from({ length: 40 }, (_, index) => (index % 5) + 1);
    expect(banded(ratings)).toEqual([]);
  });

  it('offers bands once the column holds more numbers than the palette has colours', () => {
    const shares = Array.from({ length: BAND_MIN_DISTINCT }, (_, index) => index * 10);
    const options = banded(shares);
    expect(options.map((option) => option.bands)).toEqual([...BAND_COUNT_CHOICES, ...BAND_COUNT_CHOICES]);
    expect(new Set(options.map((option) => option.bandEdges))).toEqual(new Set(['equalWidth', 'equalCount']));
  });

  it('takes a stored band rule that names no edges for the equal-width option', () => {
    expect(ruleKey({ ...WHOLE, bands: 5 })).toBe(ruleKey({ ...WHOLE, bands: 5, bandEdges: 'equalWidth' }));
    expect(ruleKey({ ...WHOLE, bands: 5 })).not.toBe(ruleKey({ ...WHOLE, bands: 5, bandEdges: 'equalCount' }));
  });

  it('counts only the numbers towards that, not the answers written in words', () => {
    const shares = Array.from({ length: BAND_MIN_DISTINCT - 1 }, (_, index) => index * 10);
    expect(banded([...shares, 'Not Reported', 'Unclear'])).toEqual([]);
  });
});
