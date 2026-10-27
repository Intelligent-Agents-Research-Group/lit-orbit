import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { MAX_ROWS } from '../config/defaults';
import { detectHeaderRow, parseFile, type ParseOptions } from './parse';

/**
 * Files here are deliberately awkward: every case is one of the shapes a
 * spreadsheet arrives in when it was maintained by someone else. The data is
 * invented.
 */

function textFile(name: string, text: string): File {
  return new File([text], name, { type: 'text/plain' });
}

function workbookFile(name: string, sheets: Record<string, unknown[][]>): File {
  const book = utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    utils.book_append_sheet(book, utils.aoa_to_sheet(rows, { cellDates: true }), sheetName);
  }
  const buffer = write(book, { type: 'array', bookType: 'xlsx', cellDates: true });
  return new File([buffer as ArrayBuffer], name);
}

const read = (file: File, options?: ParseOptions) => parseFile(file, options);

describe('header detection', () => {
  it('skips a title row and a blank row', async () => {
    const parsed = await read(
      textFile(
        'offset.csv',
        ['Literature screening 2024', '', 'Title,Year,Design', 'Alpha study,2019,RCT', 'Beta study,2021,Cohort'].join(
          '\n',
        ),
      ),
    );
    expect(Object.keys(parsed.rows[0])).toEqual(['Title', 'Year', 'Design']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.headerRow).toBe(3);
  });

  it('skips an export banner of several narrow rows', async () => {
    const matrix = [
      ['Exported from RefManager', null, null],
      ['2024-03-01', null, null],
      [null, null, null],
      ['Ref', 'Title', 'Score'],
      ['A1', 'Alpha study', 7],
    ];
    expect(detectHeaderRow(matrix)).toBe(3);
  });

  it('invents names when the table has no header', async () => {
    const parsed = await read(textFile('bare.csv', ['1,2019,4', '2,2021,5'].join('\n')));
    expect(Object.keys(parsed.rows[0])).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.headerRow).toBe(0);
  });

  it('accepts an explicit header row that overrides the guess', async () => {
    const text = ['Title,Year', 'Notes line,ignored', 'Real title,Real year', 'Alpha,2019'].join('\n');
    const parsed = await read(textFile('override.csv', text), { headerRow: 3 });
    expect(Object.keys(parsed.rows[0])).toEqual(['Real title', 'Real year']);
    expect(parsed.rows).toHaveLength(1);
  });
});

describe('column names', () => {
  it('numbers repeated headers instead of losing a column', async () => {
    const parsed = await read(textFile('dupes.csv', ['Year,Title,Year', '2019,Alpha,2021'].join('\n')));
    expect(Object.keys(parsed.rows[0])).toEqual(['Year', 'Title', 'Year (2)']);
    expect(parsed.rows[0]['Year (2)']).toBe('2021');
  });

  it('names an unnamed column that holds data', async () => {
    const parsed = await read(
      textFile('blankhead.csv', ['Title,,Design', 'Alpha,note a,RCT', 'Beta,note b,Cohort'].join('\n')),
    );
    expect(Object.keys(parsed.rows[0])).toEqual(['Title', 'Column 2', 'Design']);
    expect(parsed.rows[0]['Column 2']).toBe('note a');
  });

  it('drops a spacer column that has neither a name nor data', async () => {
    const parsed = await read(textFile('spacer.csv', ['Title,,Design', 'Alpha,,RCT', 'Beta,,Cohort'].join('\n')));
    expect(Object.keys(parsed.rows[0])).toEqual(['Title', 'Design']);
  });

  it('collapses whitespace inside a header', async () => {
    const parsed = await read(textFile('spacey.csv', ['"Study  design ", Year', 'RCT,2019'].join('\n')));
    expect(Object.keys(parsed.rows[0])).toEqual(['Study design', 'Year']);
  });
});

describe('text formats', () => {
  it('reads a file with a byte-order mark and CRLF line endings', async () => {
    const parsed = await read(textFile('bom.csv', '﻿Title,Year\r\nAlpha,2019\r\n'));
    expect(Object.keys(parsed.rows[0])).toEqual(['Title', 'Year']);
    expect(parsed.rows).toHaveLength(1);
  });

  it('reads a tab separated file', async () => {
    const parsed = await read(textFile('tabs.tsv', 'Title\tYear\nAlpha\t2019'));
    expect(parsed.rows[0]).toEqual({ Title: 'Alpha', Year: '2019' });
  });

  it('reads a one column list', async () => {
    const parsed = await read(textFile('titles.txt', ['Title', 'Alpha study', 'Beta study'].join('\n')));
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1]).toEqual({ Title: 'Beta study' });
  });

  it('keeps a quoted field that contains the delimiter and a newline', async () => {
    const parsed = await read(textFile('quoted.csv', 'Title,Note\n"Alpha, revised","line one\nline two"'));
    expect(parsed.rows[0]['Title']).toBe('Alpha, revised');
    expect(parsed.rows[0]['Note']).toBe('line one\nline two');
  });

  it('rejects a file with no rows', async () => {
    await expect(read(textFile('empty.csv', ''))).rejects.toThrow(/No rows/);
  });
});

describe('workbooks', () => {
  const dataRows = [
    ['Ref', 'Title', 'Year'],
    ['A1', 'Alpha study', 2019],
    ['A2', 'Beta study', 2021],
  ];

  it('reads the sheet holding the table, not the cover sheet', async () => {
    const file = workbookFile('book.xlsx', {
      'Read me': [['How to use this file'], ['Ask Wei before editing']],
      Studies: dataRows,
    });
    const parsed = await read(file);
    expect(parsed.sheetNames).toEqual(['Read me', 'Studies']);
    expect(parsed.sheetIndex).toBe(1);
    expect(parsed.rows).toHaveLength(2);
  });

  it('reads the sheet asked for even when another looks bigger', async () => {
    const file = workbookFile('book.xlsx', {
      Notes: [['Note'], ['one'], ['two']],
      Studies: dataRows,
    });
    const parsed = await read(file, { sheetIndex: 0 });
    expect(parsed.sheetIndex).toBe(0);
    expect(Object.keys(parsed.rows[0])).toEqual(['Note']);
  });

  it('keeps a date as a date rather than a serial number', async () => {
    const file = workbookFile('dates.xlsx', {
      Sheet1: [
        ['Title', 'Added'],
        ['Alpha', new Date(2024, 0, 15)],
      ],
    });
    const parsed = await read(file);
    expect(parsed.rows[0]['Added']).toBeInstanceOf(Date);
  });

  it('finds the header below a merged title row', async () => {
    const file = workbookFile('merged.xlsx', {
      Sheet1: [['Systematic review 2024', null, null], [null, null, null], ...dataRows],
    });
    const parsed = await read(file);
    expect(Object.keys(parsed.rows[0])).toEqual(['Ref', 'Title', 'Year']);
    expect(parsed.headerRow).toBe(3);
  });
});

describe('json', () => {
  it('reads an array of objects', async () => {
    const parsed = await read(textFile('rows.json', JSON.stringify([{ Title: 'Alpha', Year: 2019 }])));
    expect(parsed.rows[0]).toEqual({ Title: 'Alpha', Year: 2019 });
    expect(parsed.headerRow).toBe(0);
  });

  it('reads an array nested under a property', async () => {
    const parsed = await read(textFile('wrapped.json', JSON.stringify({ count: 1, records: [{ Title: 'Alpha' }] })));
    expect(parsed.rows).toHaveLength(1);
  });

  it('reads an array of arrays as a grid', async () => {
    const parsed = await read(
      textFile(
        'grid.json',
        JSON.stringify([
          ['Title', 'Year'],
          ['Alpha', 2019],
        ]),
      ),
    );
    expect(parsed.rows[0]).toEqual({ Title: 'Alpha', Year: 2019 });
  });

  it('reads a file whose extension does not match its contents', async () => {
    const parsed = await read(textFile('mislabelled.csv', JSON.stringify([{ Title: 'Alpha' }])));
    expect(parsed.rows[0]).toEqual({ Title: 'Alpha' });
  });
});

describe('size', () => {
  it('caps the rows it keeps and reports how many there were', async () => {
    const lines = ['Title,Year'];
    for (let index = 0; index < MAX_ROWS + 200; index += 1) lines.push(`Study ${index},2019`);
    const parsed = await read(textFile('big.csv', lines.join('\n')));
    expect(parsed.totalRows).toBe(MAX_ROWS + 200);
    expect(parsed.rows).toHaveLength(MAX_ROWS);
  });
});
