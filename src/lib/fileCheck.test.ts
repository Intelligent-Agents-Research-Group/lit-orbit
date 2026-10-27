import { describe, expect, it } from 'vitest';
import type { Dataset } from '../data/model';
import { buildDataset, filterMaxCategories, readDataset } from './dataset';
import { checkBatch, columnWarnings, type FileWarning, type FileWarningKind } from './fileCheck';
import type { ImportReading } from './importInfo';
import type { RawRow } from './parse';

/**
 * Tables here are deliberately awkward, each the shape a spreadsheet takes
 * when it was kept by someone with no reader in mind. The data is invented.
 */

const build = (rows: RawRow[], name = 'batch.csv'): Dataset => buildDataset(name, rows, 'file');

/** The checks over a batch read under the rules detection chose for it, as the app runs them. */
const check = (rows: RawRow[], reading: ImportReading | null, name?: string) => {
  const batch = build(rows, name);
  return checkBatch(batch, readDataset(batch, batch.rules), reading);
};

/** A file read as a grid, with its column names on line 1. */
const GRID: ImportReading = { sheetNames: [], sheetIndex: 0, headerRow: 1, totalRows: 0, keptRows: 0, grid: true };

const kinds = (warnings: FileWarning[]): FileWarningKind[] => warnings.map((warning) => warning.kind);
const ofKind = (warnings: FileWarning[], kind: FileWarningKind) => warnings.find((warning) => warning.kind === kind);

/** Ten tidy studies: one value per cell, a list column split one way, counts as numbers. */
const TIDY: RawRow[] = Array.from({ length: 10 }, (_, index) => ({
  Title: `Study ${index + 1}`,
  Design: index % 2 === 0 ? 'RCT' : 'Cohort',
  Tools: index % 3 === 0 ? 'Chat UI; IDE plugin' : 'Chat UI',
  Participants: 20 + index * 7,
}));

describe('a tidy table', () => {
  it('earns no warning', () => {
    expect(check(TIDY, GRID)).toEqual([]);
  });

  it('earns none either when nothing is known about how it was read', () => {
    expect(check(TIDY, null)).toEqual([]);
  });
});

describe('the header line', () => {
  it('says when none was found, and not again for every numbered column', () => {
    const rows = [
      { 'Column 1': 'Study 1', 'Column 2': 'RCT' },
      { 'Column 1': 'Study 2', 'Column 2': 'Cohort' },
    ];
    const warnings = check(rows, { ...GRID, headerRow: 0 });
    expect(kinds(warnings)).toEqual(['no-header']);
    // Every column can be named, since none is.
    expect(warnings[0].names).toEqual(['Column 1', 'Column 2']);
  });

  it('names the columns the file left unnamed', () => {
    const rows = [
      { Title: 'Study 1', 'Column 2': 'RCT', Year: 2020 },
      { Title: 'Study 2', 'Column 2': 'Cohort', Year: 2021 },
    ];
    const warning = ofKind(check(rows, GRID), 'unnamed-columns');
    expect(warning?.columns).toEqual(['Column 2']);
    // The user is asked to name it.
    expect(warning?.names).toEqual(['Column 2']);
    expect(warning?.message).toMatch(/^has no name/);
  });

  it('names a column that repeats another', () => {
    const rows = [
      { Year: 2019, Title: 'Study 1', 'Year (2)': 2021 },
      { Year: 2020, Title: 'Study 2', 'Year (2)': 2022 },
    ];
    expect(ofKind(check(rows, GRID), 'repeated-names')?.columns).toEqual(['Year (2)']);
  });

  it('leaves a name alone that only looks numbered', () => {
    const rows = [{ 'Cohort (2)': 'a', Title: 'Study 1' }];
    expect(ofKind(check(rows, GRID), 'repeated-names')).toBeUndefined();
  });

  it('suspects the header row when a column is named by a sentence', () => {
    const sentence = 'Students were given access to the tool for the whole semester and asked to use it freely';
    const rows = [
      { Title: 'Study 1', [sentence]: 'x' },
      { Title: 'Study 2', [sentence]: 'y' },
    ];
    expect(ofKind(check(rows, GRID), 'long-names')?.columns).toEqual([sentence]);
  });
});

describe('the table', () => {
  it('says when only one column came out of the file', () => {
    const rows = [{ 'Title;Design': 'Study 1;RCT' }, { 'Title;Design': 'Study 2;Cohort' }];
    expect(kinds(check(rows, GRID))).toContain('one-column');
  });

  it('counts rows that hold a single cell as notes', () => {
    const rows = [...TIDY, { Title: 'Source: our screening sheet' }, { Participants: 999 }];
    const warning = ofKind(check(rows, GRID), 'note-rows');
    expect(warning?.message).toMatch(/^2 rows hold/);
  });

  it('does not count a sparse row as a note in a narrow table', () => {
    const rows = [{ Title: 'Study 1', Design: 'RCT', Year: 2020 }, { Title: 'Study 2' }];
    expect(ofKind(check(rows, GRID), 'note-rows')).toBeUndefined();
  });
});

describe('separators', () => {
  /** A tags column written two ways: half the coders used semicolons, half commas. */
  const twoWays = (cells: string[]): RawRow[] => cells.map((Tools, index) => ({ Title: `Study ${index + 1}`, Tools }));

  it('says when a column separates values with two characters', () => {
    const rows = twoWays(['A; B', 'B; C', 'A; C', 'A; B; C', 'A, B', 'B, C', 'A, C', 'A, B, C', 'A', 'B']);
    const warning = ofKind(check(rows, GRID), 'mixed-delimiters');
    expect(warning?.columns).toEqual(['Tools']);
    expect(warning?.separators).toEqual([';', ',']);
    expect(warning?.message).toMatch(/both a semicolon and a comma/);
  });

  it('does not take one separator inside another for two', () => {
    const rows = twoWays(['A; B, C', 'B; C, D', 'A; C, D', 'A; B, D', 'B; A, C', 'A; B', 'B; C', 'C; D']);
    expect(ofKind(check(rows, GRID), 'mixed-delimiters')).toBeUndefined();
  });

  it('leaves a title column alone, commas and semicolons included', () => {
    const rows = twoWays([
      'Pair programming, revisited: a study',
      'Teaching with tutors; learning without',
      'Code, comments and confusion',
      'Debugging; a first course',
      'On tutors, graders and gatekeepers',
      'Prompts; a taxonomy',
    ]);
    expect(check(rows, GRID)).toEqual([]);
  });

  it('says when a column holds lists on a character the app does not split on', () => {
    const rows = twoWays([
      'Python + Java',
      'Python + Java',
      'Python + Java',
      'Java + C',
      'Java + C',
      'Python + C',
      'Python + C',
      'Python',
      'Java',
      'C',
    ]);
    const warning = ofKind(check(rows, GRID), 'unsplit-delimiter');
    expect(warning?.columns).toEqual(['Tools']);
    expect(warning?.message).toMatch(/a plus sign/);
  });

  it('does not take the word "or" in prose for a separator', () => {
    const rows = twoWays([
      'Students could use the tool or not, as they chose',
      'Either the tutor or the grader was shown',
      'No tool',
      'Tool shown to all',
    ]);
    expect(ofKind(check(rows, GRID), 'unsplit-delimiter')).toBeUndefined();
  });
});

describe('a vocabulary too large to use', () => {
  /** Enough studies for a few more tools than a filter may hold to repeat. */
  const ROWS = 50;
  /** `ROWS` studies, each naming two of a list of tools. */
  const tools = (names: string[]): RawRow[] =>
    Array.from({ length: ROWS }, (_, index) => ({
      Title: `Study ${index + 1}`,
      Tools: `${names[index % names.length]}; ${names[(index * 7 + 3) % names.length]}`,
    }));
  const fourteen = Array.from({ length: 14 }, (_, index) => `Tool ${index + 1}`);
  /** How many values a filter may hold in a batch this long, whatever `FILTER_MAX_CATEGORIES` is set to. */
  const limit = filterMaxCategories(ROWS);
  /** A few more tools than that. */
  const tooMany = Array.from({ length: limit + 4 }, (_, index) => `Tool ${index + 1}`);

  it('says when a list column yields more values than a filter may hold, yet far fewer than its cells', () => {
    // The cells repeat every few rows, so no separator lowers the count: the column is judged whole.
    const warning = ofKind(check(tools(tooMany), GRID), 'many-values');
    expect(warning?.columns).toEqual(['Tools']);
    expect(warning?.message).toMatch(new RegExp(`^yields ${limit + 4} distinct values from ${ROWS} cells`));
    expect(warning?.fix).toMatch(new RegExp(`${limit} at most to filter on`));
  });

  it('leaves a column alone that a filter can hold', () => {
    expect(ofKind(check(tools(fourteen.slice(0, 8)), GRID), 'many-values')).toBeUndefined();
  });

  it('leaves free text alone', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ Title: `Study ${index + 1}`, Note: `Remark ${index}` }));
    expect(ofKind(check(rows, GRID), 'many-values')).toBeUndefined();
  });

  it('still says it of a column whose values repeat only a little', () => {
    // 59 distinct venues over 60 studies: one repeat is enough to mean a vocabulary.
    const rows = Array.from({ length: 60 }, (_, index) => ({
      Title: `Study ${index + 1}`,
      Venue: `Venue ${index % 59}`,
    }));
    expect(ofKind(check(rows, GRID), 'many-values')?.message).toMatch(/^yields 59 distinct values/);
    // Every cell different is the line: that is free text.
    const prose = Array.from({ length: 60 }, (_, index) => ({
      Title: `Study ${index + 1}`,
      Venue: `Venue ${index}`,
    }));
    expect(ofKind(check(prose, GRID), 'many-values')).toBeUndefined();
  });

  it('leaves a scale alone', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      Title: `Study ${index + 1}`,
      Size: 20 + (index % 15) * 9,
    }));
    expect(ofKind(check(rows, GRID), 'many-values')).toBeUndefined();
  });

  it('is not said of a column whose separators already explain the count', () => {
    // Fifteen distinct pairs of the fourteen tools, written with a semicolon
    // in half the rows and a comma in the other half.
    const pairs = [...fourteen.map((tool, index) => [tool, fourteen[(index + 1) % 14]]), [fourteen[0], fourteen[2]]];
    const rows = pairs.flatMap(([a, b], index) => [
      { Title: `Study ${index * 2 + 1}`, Tools: `${a}; ${b}` },
      { Title: `Study ${index * 2 + 2}`, Tools: `${a}, ${b}` },
    ]);
    const warnings = columnWarnings(check(rows, GRID), 'Tools');
    expect(kinds(warnings)).toEqual(['mixed-delimiters']);
  });
});

describe('separators that do not go far enough', () => {
  const tools = (cells: string[]): RawRow[] => cells.map((Tools, index) => ({ Title: `Study ${index + 1}`, Tools }));
  /** How many values a filter may hold in a batch this long, whatever `FILTER_MAX_CATEGORIES` is set to. */
  const limit = (rows: RawRow[]) => filterMaxCategories(rows.length);

  it('names a second separator left inside the pieces, however few values there are', () => {
    // Every cell uses both the same way, so neither is used without the other.
    const rows = tools([
      'A; B, C',
      'A; B, C',
      'E; B, C',
      'A; C, D',
      'E; C, D',
      'A; B, D',
      'E; B, D',
      'A; C, B',
      'E; D, C',
      'A; B, C, D',
      'A; E',
      'E; A',
    ]);
    const warnings = columnWarnings(check(rows, GRID), 'Tools');
    expect(kinds(warnings)).toEqual(['second-delimiter']);
    expect(warnings[0].message).toBe(
      'is split on a semicolon, but a comma still sits between values inside the pieces ("B, C"): it may use both. Split on both, it holds 5 distinct values.',
    );
    expect(warnings[0].fix).toBe('Split on both, and write every value separated by a semicolon.');
    expect(warnings[0].separators).toEqual([';', ',']);
  });

  it('counts a list column whose split lowers the count yet leaves more than a filter may hold', () => {
    // Fifty studies naming two of thirty-seven topics, separated by a comma.
    const rows = tools(Array.from({ length: 50 }, (_, index) => `Topic ${index % 37}, Topic ${(index * 3 + 1) % 36}`));
    const warnings = columnWarnings(check(rows, GRID), 'Tools');
    expect(kinds(warnings)).toEqual(['many-values']);
    expect(warnings[0].message).toBe(
      `splitting on a comma brings it from 50 distinct values to 37: fewer, so it does sit between values, but still more than a filter may hold (${limit(rows)}).`,
    );
    // A column to change, not one that may be free text and left alone.
    expect(warnings[0].fix).toMatch(
      /^Look at what the split leaves for a second separator, and split on it too\. Merge/,
    );
  });

  it('counts it however many of the cells differ', () => {
    // Sixty studies naming three of thirty-five keywords: every cell differs, and it is still a vocabulary.
    const rows = tools(
      Array.from(
        { length: 60 },
        (_, index) => `Keyword ${index % 35}; Keyword ${(index * 7 + 3) % 35}; Keyword ${((index * 3 + 1) % 33) + 1}`,
      ),
    );
    expect(ofKind(check(rows, GRID), 'many-values')?.message).toMatch(
      /^splitting on a semicolon brings it from 60 distinct values to 35/,
    );
  });

  it('finds two separators the reader splits on neither of, because each alone leaves more values', () => {
    // "A, B; C, D": split on either one alone, the pieces are pairs, more varied than the cells were.
    const rows = tools(
      Array.from(
        { length: 80 },
        (_, index) =>
          `Topic ${index % 35}, Topic ${(index * 3 + 1) % 33}; Topic ${(index * 7 + 2) % 34}, Topic ${(index * 11 + 5) % 31}`,
      ),
    );
    const warning = ofKind(check(rows, GRID), 'second-delimiter');
    expect(warning?.message).toBe(
      `is read as one value per cell, yet separates its values with both a semicolon and a comma ("Topic 0, Topic 1; Topic 2, Topic 5"). Split on both, it holds 35 distinct values rather than 80, still more than a filter may hold (${limit(rows)}).`,
    );
    expect(warning?.fix).toMatch(
      /^Split on both, and write every value separated by a semicolon\. Then merge the values/,
    );
    expect(warning?.separators).toEqual([';', ',']);
  });

  /** `rows` studies in `countries` countries, every tenth run in two of them. */
  const countries = (rows: number, count: number): RawRow[] =>
    Array.from({ length: rows }, (_, index) => ({
      Title: `Study ${index + 1}`,
      Country:
        index % 10 === 0 ? `Country ${index % count}, Country ${(index + 3) % count}` : `Country ${index % count}`,
    }));

  it('says a column read whole would have few enough values split', () => {
    // Sixty studies in twenty-eight countries: the pairs take it past the limit, the countries alone do not.
    const rows = countries(60, 28);
    // Read whole: the comma is too rare for the reader to split on by itself.
    expect(build(rows).rules.Country.split).toBeNull();
    const warning = ofKind(check(rows, GRID), 'unsplit-delimiter');
    expect(warning?.columns).toEqual(['Country']);
    expect(warning?.message).toBe(
      `is read as one value per cell, with 34 distinct values - more than a filter may hold (${limit(rows)}) - yet a comma sits between values: split on it, it would hold 28.`,
    );
  });

  it('says a column read whole would still have too many values split', () => {
    // A hundred studies in thirty-five countries: past the limit split or not.
    const rows = countries(100, 35);
    expect(build(rows).rules.Country.split).toBeNull();
    const warning = ofKind(check(rows, GRID), 'many-values');
    expect(warning?.columns).toEqual(['Country']);
    expect(warning?.message).toBe(
      `is read as one value per cell, yet a comma sits between values: splitting on it would bring it from 42 distinct values to 35, still more than a filter may hold (${limit(rows)}).`,
    );
  });

  it('is not said of a split that leaves a vocabulary', () => {
    expect(check(TIDY, GRID)).toEqual([]);
  });

  it('is not said of titles that hold commas and semicolons', () => {
    const rows = tools([
      'Pair programming, revisited: a study',
      'Teaching with tutors; learning without',
      'Code, comments and confusion',
      'Debugging; a first course',
      'On tutors, graders and gatekeepers',
      'Prompts; a taxonomy',
    ]);
    expect(check(rows, GRID)).toEqual([]);
  });

  it('gives way to the mixed-separator finding', () => {
    const rows = tools(['A; B', 'B; C', 'A; C', 'A; B; C', 'A, B', 'B, C', 'A, C', 'A, B, C', 'A', 'B']);
    expect(kinds(columnWarnings(check(rows, GRID), 'Tools'))).toEqual(['mixed-delimiters']);
  });
});

describe('numbers', () => {
  const column = (cells: unknown[], key = 'Participants'): RawRow[] =>
    cells.map((cell, index) => ({ Title: `Study ${index + 1}`, [key]: cell }));

  it('says when a column writes its numbers inside text', () => {
    const rows = column([
      '150 students',
      '32 students',
      '~200',
      '41.7%',
      'n = 45',
      '1,200',
      '88',
      '12 teams',
      '300 users',
      '27',
    ]);
    const warning = ofKind(check(rows, GRID), 'numbers-in-text');
    expect(warning?.columns).toEqual(['Participants']);
    expect(warning?.message).toMatch(/"150 students"/);
  });

  it('leaves a column of counts alone when a few cells say "Not reported"', () => {
    const rows = column([150, 32, 200, 'Not reported', 45, 1200, 88, 'Not reported', 300, 27]);
    expect(ofKind(check(rows, GRID), 'numbers-in-text')).toBeUndefined();
  });

  it('leaves a category alone whose values happen to hold a number', () => {
    const rows = column(['Fall 2023', 'Spring 2024', 'Fall 2023', 'Fall 2023', 'Spring 2024', 'Fall 2023'], 'Term');
    expect(ofKind(check(rows, GRID), 'numbers-in-text')).toBeUndefined();
  });

  it('leaves codes alone', () => {
    const rows = column(['S01', 'S02', 'S03', 'S04', 'S05', 'S06'], 'Code');
    expect(ofKind(check(rows, GRID), 'numbers-in-text')).toBeUndefined();
  });
});

describe('JSON', () => {
  it('says when a cell held an object', () => {
    const rows = [
      { title: 'Study 1', venue: { name: 'SIGCSE', year: 2023 } },
      { title: 'Study 2', venue: { name: 'ITiCSE', year: 2024 } },
    ];
    const warning = ofKind(check(rows, null, 'batch.json'), 'nested-values');
    expect(warning?.columns).toEqual(['venue']);
  });
});

describe('warnings by column', () => {
  it('finds the ones about a column and leaves the table-wide ones out', () => {
    const rows = [...TIDY.map((row) => ({ ...row, Size: `${row.Participants} students` })), { Title: 'A note' }];
    const warnings = check(rows, GRID);
    expect(kinds(columnWarnings(warnings, 'Size'))).toEqual(['numbers-in-text']);
    expect(columnWarnings(warnings, 'Title')).toEqual([]);
    expect(kinds(warnings)).toContain('note-rows');
  });
});
