import { describe, expect, it } from 'vitest';
import { buildDataset, filterMaxCategories } from './dataset';
import type { FileWarning } from './fileCheck';
import type { ImportReading } from './importInfo';
import { reshapeInstruction } from './reshapeInstruction';

/** What the instruction has to carry for an assistant to write the script from it. The data is invented. */

const batch = buildDataset(
  'screening.xlsx',
  [
    { Title: 'Study 1', Tools: 'A; B', Size: '150 students' },
    { Title: 'Study 2', Tools: 'A, C', Size: '32 students' },
  ],
  'file',
);

const workbook: ImportReading = {
  sheetNames: ['Notes', 'Results', 'Codebook'],
  sheetIndex: 1,
  headerRow: 2,
  totalRows: 2,
  keptRows: 2,
  grid: true,
};

const warnings: FileWarning[] = [
  {
    kind: 'mixed-delimiters',
    columns: ['Tools'],
    message: 'uses both a semicolon and a comma between values.',
    fix: 'Separate the values with a semicolon throughout.',
  },
  { kind: 'note-rows', columns: [], message: '1 row holds a single cell.', fix: 'Keep one row per study.' },
];

describe('the instruction for an assistant', () => {
  it('describes the file: its name, sheet, header line, size and columns', () => {
    const text = reshapeInstruction(batch, workbook, warnings, 'script');
    expect(text).toContain('Name: screening.xlsx (an Excel workbook)');
    expect(text).toContain('Sheet: "Results" (2nd of 3)');
    expect(text).toContain('The column names are on line 2.');
    expect(text).toContain('2 rows of studies, 3 columns.');
    expect(text).toContain('Columns, in order: "Title", "Tools", "Size".');
  });

  it('says what to change, one numbered point per warning, column first', () => {
    const text = reshapeInstruction(batch, workbook, warnings, 'script');
    expect(text).toContain(
      '1. "Tools" uses both a semicolon and a comma between values. Separate the values with a semicolon throughout.',
    );
    expect(text).toContain('2. 1 row holds a single cell. Keep one row per study.');
  });

  it('asks for nothing in particular when nothing was found', () => {
    const text = reshapeInstruction(batch, workbook, [], 'script');
    expect(text).toContain('found nothing in particular');
    expect(text).not.toMatch(/^1\. /m);
  });

  it('leaves out what is not known about a file read from storage', () => {
    const text = reshapeInstruction(batch, null, [], 'script');
    expect(text).not.toContain('Sheet:');
    expect(text).not.toContain('column names are on line');
    expect(text).toContain('Name: screening.xlsx');
  });

  it('names the file to write next to the original', () => {
    expect(reshapeInstruction(batch, workbook, [], 'script')).toContain('"screening-for-lit-orbit.xlsx"');
    const bare = buildDataset('list', [{ a: 1 }], 'file');
    expect(reshapeInstruction(bare, null, [], 'script')).toContain('"list-for-lit-orbit.csv"');
  });

  it('carries the shape the reader does best with', () => {
    const text = reshapeInstruction(batch, workbook, [], 'script');
    expect(text).toContain('One table, one study per row.');
    expect(text).toContain('semicolon');
  });

  it('asks for a second separator to be looked for in every list column', () => {
    const text = reshapeInstruction(batch, workbook, [], 'script');
    expect(text).toContain('check for a second separator');
    expect(text).toContain(
      `yet more remain than Lit Orbit can filter on (${filterMaxCategories(batch.rows.length)} at most for this file)`,
    );
  });

  it('asks for one script, run with one command beside the file', () => {
    const text = reshapeInstruction(batch, workbook, [], 'script');
    expect(text).toContain('run with one command: python reshape_for_lit_orbit.py.');
    expect(text).toContain('The file name "screening.xlsx" is set on its first lines');
    expect(text).not.toMatch(/notebook|Colab/);
  });

  it('asks for notebook code in as few cells as it takes, run top to bottom', () => {
    const text = reshapeInstruction(batch, workbook, [], 'notebook');
    expect(text).toContain('Code for a Jupyter notebook');
    expect(text).toContain('as few cells as it takes, one if it can be, with nothing to edit between them');
    expect(text).toContain('run top to bottom');
    expect(text).not.toContain('google.colab');
  });

  it('asks for Colab code that takes the file in and hands the result back', () => {
    const text = reshapeInstruction(batch, workbook, [], 'colab');
    expect(text).toContain('Code for a Google Colab notebook');
    expect(text).toContain('as few cells as it takes, one if it can be, with nothing to edit between them');
    expect(text).toContain('files.upload()');
    expect(text).toContain('files.download()');
  });

  it('asks every kind of code to be easy to run and to say what it changed', () => {
    for (const target of ['script', 'notebook', 'colab'] as const) {
      const text = reshapeInstruction(batch, workbook, [], target);
      expect(text).toContain('Keep it as short and as easy to run as you can');
      expect(text).toContain('put my answers to your questions into the code');
      expect(text).toContain('print a short summary of what changed');
    }
    // Colab is handed the file by upload, so there is no name to set there.
    expect(reshapeInstruction(batch, workbook, [], 'colab')).not.toContain('beyond the file name');
    expect(reshapeInstruction(batch, workbook, [], 'notebook')).toContain('beyond the file name');
  });

  it('mentions openpyxl only for a workbook', () => {
    const csv = buildDataset('batch.csv', [{ a: 1 }], 'file');
    for (const target of ['script', 'notebook', 'colab'] as const) {
      expect(reshapeInstruction(batch, workbook, [], target)).toContain('openpyxl');
      expect(reshapeInstruction(csv, null, [], target)).not.toContain('openpyxl');
    }
  });
});

describe('what only the user can say', () => {
  const unnamed: FileWarning = {
    kind: 'unnamed-columns',
    columns: ['Column 3', 'Column 5'],
    message: 'have no name in the file.',
    fix: 'Give every column a short name.',
    names: ['Column 3', 'Column 5'],
  };
  const mixed: FileWarning = {
    kind: 'mixed-delimiters',
    columns: ['Tools'],
    message: 'uses both a semicolon and a comma between values.',
    fix: 'Separate the values with a semicolon throughout.',
    separators: [';', ','],
  };
  const ask = (...found: FileWarning[]) => reshapeInstruction(batch, workbook, found, 'script');

  it('has the AI ask the user every question at once, before any code', () => {
    expect(ask(unnamed)).toContain('Ask me all of those questions together, in one message, before you write any code');
  });

  it('asks what to call an unnamed column, and keeps its name when the user gives none', () => {
    const text = ask(unnamed);
    expect(text).toContain('Ask me what to call the 3rd column ("Column 3") and the 5th column ("Column 5")');
    expect(text).toContain('a column I give no name keeps the name it has here.');
    expect(text).not.toContain('Give every column a short name.');
  });

  it('asks for every name in order when the table has no header line', () => {
    const noHeader: FileWarning = {
      kind: 'no-header',
      columns: [],
      message: 'No line of column names was found.',
      fix: 'Put the column names on the first line.',
      names: ['Column 1', 'Column 2'],
    };
    expect(ask(noHeader)).toContain('Ask me what each column is called, in order;');
  });

  it('asks what each separator does, allowing one at most to stay in the column', () => {
    const text = ask(mixed);
    expect(text).toContain('Ask me what each of a semicolon and a comma does in this column:');
    expect(text).toContain('splitting the column into separate columns ("Tools 1", "Tools 2" and so on, in order)');
    expect(text).toContain('The column can keep one separator at most');
    expect(text).toContain('If I do not say, keep a semicolon and rewrite a comma as it.');
  });

  it('asks nothing when no point needs the user', () => {
    const plain: FileWarning = {
      kind: 'note-rows',
      columns: [],
      message: '1 row holds a single cell.',
      fix: 'Keep one row per study.',
    };
    const text = ask(plain);
    expect(text).not.toContain('Ask me');
    expect(text).toContain('1. 1 row holds a single cell. Keep one row per study.');
  });
});
