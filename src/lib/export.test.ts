import { describe, expect, it } from 'vitest';
import type { ColumnMapping, Dataset } from '../data/model';
import { WHOLE } from './columnRules';
import { buildDataset, readDataset, studiesFrom } from './dataset';
import {
  EXPORT_FORMATS,
  exportFileName,
  exportKeys,
  serialiseRows,
  studyRows,
  tierColumnName,
  type ExportFormat,
} from './export';
import { computeOrbitModel, type OrbitNode } from './layout';
import { parseFile, type RawRow } from './parse';

/**
 * What a downloaded set holds, and that the app can read it back: a file
 * written here is regularly loaded again as a batch of its own. The data is
 * invented.
 */

const RAW: RawRow[] = [
  { Title: 'Alpha, revisited', Tier: 1, Tools: 'ChatGPT; Copilot', Participants: 40 },
  { Title: 'Beta study', Tier: 3, Tools: 'Copilot', Participants: null },
];

const MAPPING: ColumnMapping = {
  labelKey: 'Title',
  wedgeKey: null,
  colourKey: null,
  sizeKey: null,
  tierKey: 'Tier',
};

/** A batch with the tools column read as a list, and its studies as the orbit sees them. */
function batchOf(raw: RawRow[] = RAW): { dataset: Dataset; nodes: OrbitNode[] } {
  const stored = buildDataset('screening batch.csv', raw, 'file');
  const dataset = readDataset(stored, { ...stored.rules, Tools: { ...WHOLE, split: ';' } });
  const studies = studiesFrom(dataset, MAPPING);
  const model = computeOrbitModel({
    dataset,
    studies,
    mapping: MAPPING,
    filters: {},
    tierRules: [],
    tierSource: 'column',
  });
  return { dataset, nodes: model.nodes };
}

/**
 * The file as it was written, mark and all: `Blob.text()` decodes UTF-8,
 * which drops a leading byte-order mark.
 */
async function writtenText(blob: Blob): Promise<string> {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer());
}

/** The file as the app would read it back. */
async function readBack(blob: Blob, format: ExportFormat): Promise<RawRow[]> {
  const extension = EXPORT_FORMATS.find((option) => option.id === format)!.extension;
  const parsed = await parseFile(new File([blob], `download.${extension}`));
  return parsed.rows;
}

describe('the rows a download holds', () => {
  it('writes the ring first, then every column of the batch', () => {
    const { dataset, nodes } = batchOf();
    expect(exportKeys(dataset)).toEqual(['Orbit tier', 'Title', 'Tier', 'Tools', 'Participants']);
    expect(studyRows(nodes, dataset)[0]).toEqual({
      'Orbit tier': 1,
      Title: 'Alpha, revisited',
      Tier: 1,
      Tools: ['ChatGPT', 'Copilot'],
      Participants: 40,
    });
  });

  it('names the ring column around one the batch already uses', () => {
    const { dataset } = batchOf();
    expect(tierColumnName(dataset.columns)).toBe('Orbit tier');
    expect(tierColumnName([])).toBe('Tier');
  });

  it('writes an empty cell as empty rather than dropping the column', () => {
    const { dataset, nodes } = batchOf();
    expect(studyRows(nodes, dataset)[1].Participants).toBeNull();
  });
});

describe('the formats', () => {
  it('quotes a value holding the delimiter and joins a list on a semicolon', async () => {
    const { dataset, nodes } = batchOf();
    const csv = await writtenText(await serialiseRows(studyRows(nodes, dataset), exportKeys(dataset), 'csv'));
    const lines = csv.split('\r\n');
    // Excel needs the byte-order mark to read the file as UTF-8.
    expect(lines[0]).toBe('﻿Orbit tier,Title,Tier,Tools,Participants');
    expect(lines[1]).toBe('1,"Alpha, revisited",1,ChatGPT; Copilot,40');
    expect(lines[2]).toBe('3,Beta study,3,Copilot,');
  });

  it('separates a TSV on tabs', async () => {
    const { dataset, nodes } = batchOf();
    const tsv = await writtenText(await serialiseRows(studyRows(nodes, dataset), exportKeys(dataset), 'tsv'));
    expect(tsv.split('\r\n')[1].split('\t')).toEqual(['1', 'Alpha, revisited', '1', 'ChatGPT; Copilot', '40']);
  });

  it('keeps lists as lists and numbers as numbers in JSON', async () => {
    const { dataset, nodes } = batchOf();
    const json = await (await serialiseRows(studyRows(nodes, dataset), exportKeys(dataset), 'json')).text();
    expect(JSON.parse(json)[0]).toEqual({
      'Orbit tier': 1,
      Title: 'Alpha, revisited',
      Tier: 1,
      Tools: ['ChatGPT', 'Copilot'],
      Participants: 40,
    });
  });

  it.each(EXPORT_FORMATS.map((format) => format.id))('reads a downloaded %s back in', async (format) => {
    const { dataset, nodes } = batchOf();
    const blob = await serialiseRows(studyRows(nodes, dataset), exportKeys(dataset), format);
    const rows = await readBack(blob, format);
    expect(rows).toHaveLength(2);
    expect(Object.keys(rows[0])).toEqual(['Orbit tier', 'Title', 'Tier', 'Tools', 'Participants']);
    expect(String(rows[0].Title)).toBe('Alpha, revisited');
    expect(Number(rows[1]['Orbit tier'])).toBe(3);
  });
});

describe('the file name', () => {
  it('says which batch and which set, without the extension of the file it came from', () => {
    expect(exportFileName('screening batch.csv', 'matches', 'xlsx')).toBe('screening-batch-matches.xlsx');
    expect(exportFileName('Built-in batch', 'studies', 'csv')).toBe('built-in-batch-studies.csv');
  });

  it('falls back to the app name when the batch name has nothing to slug', () => {
    expect(exportFileName('...', 'matches', 'json')).toBe('lit-orbit-matches.json');
  });
});
