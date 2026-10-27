import { describe, expect, it } from 'vitest';
import type { TierRule } from '../config/tierRules';
import type { ColumnRules } from '../data/model';
import { buildDataset, readDataset } from './dataset';
import type { RawRow } from './parse';
import {
  isSiteConfig,
  paperLink,
  presetFromSite,
  publishedIndexHtml,
  readSiteConfig,
  readSiteFile,
  serialiseSiteConfig,
  siteBatch,
  siteConfigFrom,
  siteStorageNamespace,
  type SiteConfig,
  type SiteInfo,
  type SiteSetup,
} from './site';
import { pruneRuleValues, tierFromRules } from './tiers';

/**
 * These check a published site: that what its author set up is what its
 * readers get. The batch is invented, and written the awkward way real ones
 * are - answers with notes after a dash, several tools to a cell, a count
 * that is sometimes not a number.
 */

const ROWS: RawRow[] = [
  {
    Title: 'Barke 2023',
    Design: 'RCT',
    Tools: 'ChatGPT; Copilot',
    Trained: 'Yes - a workshop',
    Participants: 120,
    Level: 100,
  },
  { Title: 'Kazemi 2023', Design: 'Quasi', Tools: 'Copilot', Trained: 'No - none', Participants: 69, Level: 200 },
  {
    Title: 'Lau 2024',
    Design: 'Survey',
    Tools: 'ChatGPT; Bard',
    Trained: 'Yes - in class',
    Participants: 'Not Reported',
    Level: 100,
  },
  {
    Title: 'Prather 2023',
    Design: 'RCT',
    Tools: 'Copilot; ChatGPT',
    Trained: 'No - not said',
    Participants: 45,
    Level: 300,
  },
  {
    Title: 'Nguyen 2024',
    Design: 'Survey',
    Tools: 'Bard',
    Trained: 'Yes - a handout',
    Participants: 300,
    Level: 200,
    Notes: null,
  },
];

const TIER_RULES: TierRule[] = [
  { tier: 1, name: 'Randomised', conditions: [{ key: 'Design', values: ['RCT'] }] },
  // A condition left with no values matches nothing, so this whole rule does.
  {
    tier: 2,
    name: 'Unfinished',
    conditions: [
      { key: 'Design', values: ['Survey'] },
      { key: 'Trained', values: [] },
    ],
  },
  { tier: 5, name: 'Everything else', conditions: [] },
];

const INFO: SiteInfo = {
  title: '  AI in CS1: an evidence map ',
  description: 'Studies of AI tools in first-year programming.',
  paper: { citation: 'Liu, J. (2026). A map.', url: 'https://doi.org/10.1234/map' },
  madeWith: 'https://lit-orbit.example/',
};

/** An author's setup: the guesses, with some of them changed. */
function authorSetup(): SiteSetup {
  const batch = buildDataset('screening.xlsx', ROWS, 'file');
  const columnRules: ColumnRules = {
    ...batch.rules,
    Trained: { split: null, prefix: 'dash', bands: null },
    Participants: { split: null, prefix: null, bands: 3, bandEdges: 'equalCount' },
  };
  return {
    batch,
    columnRules,
    mapping: { labelKey: 'Title', wedgeKey: 'Design', colourKey: 'Trained', sizeKey: null, tierKey: null },
    filterKeys: ['Level', 'Tools'],
    tierSource: 'rules',
    tierRules: TIER_RULES,
    courseName: 'CS1',
  };
}

const roundTrip = (config: SiteConfig) => readSiteConfig(JSON.parse(serialiseSiteConfig(config)));

describe('writing a site', () => {
  it('reads back as it was written', () => {
    const config = siteConfigFrom(authorSetup(), INFO);
    expect(roundTrip(config)).toEqual(config);
  });

  it('trims what the author typed', () => {
    const config = siteConfigFrom(authorSetup(), INFO);
    expect(config.title).toBe('AI in CS1: an evidence map');
  });

  it('writes a rule for every column, including those read whole', () => {
    const config = siteConfigFrom(authorSetup(), INFO);
    expect(Object.keys(config.columnRules)).toEqual(config.batch.columns);
    expect(config.columnRules.Title).toEqual({ split: null, prefix: null, bands: null });
    expect(config.columnRules.Trained.prefix).toBe('dash');
  });

  it('keeps a column no study fills, so the table keeps its shape', () => {
    const config = siteConfigFrom(authorSetup(), INFO);
    expect(config.batch.columns).toContain('Notes');
    expect(config.batch.rows.every((row) => row.length === config.batch.columns.length)).toBe(true);
  });

  it('puts the settings first and one study on each line', () => {
    const text = serialiseSiteConfig(siteConfigFrom(authorSetup(), INFO));
    expect(text.indexOf('"title"')).toBeLessThan(text.indexOf('"rows"'));
    const rowLines = text.split('\n').filter((line) => line.trimStart().startsWith('["'));
    expect(rowLines).toHaveLength(ROWS.length);
    expect(rowLines[0]).toContain('Barke 2023');
  });
});

describe('what a reader of the site gets', () => {
  it('is the batch read exactly as its author read it', () => {
    const setup = authorSetup();
    const config = roundTrip(siteConfigFrom(setup, INFO));
    const seenByAuthor = readDataset(setup.batch, setup.columnRules);
    const site = siteBatch(config, 'base');
    const seenByReader = readDataset(site, site.rules);
    expect(seenByReader.rows).toEqual(seenByAuthor.rows);
    expect(seenByReader.columns).toEqual(seenByAuthor.columns);
    // The rules did their work: a cut answer and a count grouped into bands.
    expect(seenByReader.rows[0].Trained).toBe('Yes');
    expect(seenByReader.rows[0].Tools).toEqual(['ChatGPT', 'Copilot']);
  });

  it('keeps the author’s tier rules as they are, rather than fitting them again', () => {
    const setup = authorSetup();
    const preset = presetFromSite(roundTrip(siteConfigFrom(setup, INFO)));
    const dataset = readDataset(preset.batch, preset.batch.rules);
    const rules = pruneRuleValues(preset.tierRules, dataset);
    expect(rules).toEqual(TIER_RULES);
    // The unfinished rule claims nothing, for the author and for the reader.
    const survey = dataset.rows.find((row) => row.Title === 'Lau 2024')!;
    expect(tierFromRules(survey, rules)).toBe(5);
  });

  it('comes with the roles, filters and course its author chose', () => {
    const preset = presetFromSite(roundTrip(siteConfigFrom(authorSetup(), INFO)));
    expect(preset.batch.source).toBe('base');
    expect(preset.mapping.wedgeKey).toBe('Design');
    expect(preset.filterKeys).toEqual(['Level', 'Tools']);
    expect(preset.courseName).toBe('CS1');
  });
});

describe('reading a site.json', () => {
  const written = () => JSON.parse(serialiseSiteConfig(siteConfigFrom(authorSetup(), INFO)));

  it('tells a site.json from any other JSON', () => {
    expect(isSiteConfig(written())).toBe(true);
    expect(isSiteConfig([{ Title: 'A study' }])).toBe(false);
    expect(isSiteConfig({ studies: [] })).toBe(false);
  });

  it('reads a site written while there was still an id role', () => {
    const file = written();
    file.mapping.idKey = 'Title';
    expect(readSiteConfig(file).mapping).toEqual(authorSetup().mapping);
  });

  it('refuses a format newer than it knows', () => {
    const file = { ...written(), format: 2 };
    expect(() => readSiteConfig(file)).toThrow(/newer Lit Orbit/);
  });

  it('says where a hand edit went wrong', () => {
    const file = written();
    file.tierRules[0].tier = 7;
    expect(() => readSiteConfig(file)).toThrow('"tierRules[0].tier"');
  });

  it('reads a band rule written before the edges could be chosen as equal width', () => {
    const file = written();
    delete file.columnRules.Participants.bandEdges;
    expect(readSiteConfig(file).columnRules.Participants).toEqual({ split: null, prefix: null, bands: 3 });
  });

  it('refuses band edges it does not know', () => {
    const file = written();
    file.columnRules.Participants.bandEdges = 'quartiles';
    expect(() => readSiteConfig(file)).toThrow('"columnRules.Participants.bandEdges"');
  });

  it('refuses a row with more cells than there are columns', () => {
    const file = written();
    file.batch.rows[1].push('one too many');
    expect(() => readSiteConfig(file)).toThrow('"batch.rows[1]"');
  });

  it('links only to web addresses', () => {
    const file = written();
    file.paper.url = 'javascript:alert(1)';
    expect(() => readSiteConfig(file)).toThrow('"paper.url"');
  });
});

describe('a site.json handed to the batch loader', () => {
  const siteText = () => serialiseSiteConfig(siteConfigFrom(authorSetup(), INFO));

  it('is read back as the site', async () => {
    const config = await readSiteFile(new File([siteText()], 'site.json'));
    expect(config?.title).toBe('AI in CS1: an evidence map');
  });

  it('is read past a byte-order mark', async () => {
    const config = await readSiteFile(new File([String.fromCharCode(0xfeff) + siteText()], 'site.json'));
    expect(config).not.toBeNull();
  });

  it('leaves any other file to be read as a batch', async () => {
    expect(await readSiteFile(new File(['[{"Title":"A study"}]'], 'batch.json'))).toBeNull();
    expect(await readSiteFile(new File(['Title\nA study'], 'batch.csv'))).toBeNull();
  });

  it('is an error, not a batch, when it says it is a site and is broken', async () => {
    const broken = siteText().replace('"tierSource": "rules"', '"tierSource": "stars"');
    await expect(readSiteFile(new File([broken], 'site.json'))).rejects.toThrow('"tierSource"');
  });
});

describe('the published page', () => {
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <title>Lit Orbit</title>',
    '  </head>',
    '  <body></body>',
    '</html>',
  ].join('\n');
  const config = siteConfigFrom(authorSetup(), INFO);

  it('carries the site’s title and the marker naming its site.json', () => {
    const page = publishedIndexHtml(html, config);
    expect(page).toContain('<title>AI in CS1: an evidence map</title>');
    // Indented like the rest of the head, with `</head>` left where it was.
    expect(page).toContain('\n    <meta name="lit-orbit-site" content="site.json" />\n');
    expect(page).toContain(
      '\n    <meta name="description" content="Studies of AI tools in first-year programming." />\n  </head>',
    );
  });

  it('writes a title as text, whatever characters it holds', () => {
    const page = publishedIndexHtml(html, { ...config, title: 'Tools & "tips" <2024> $& more' });
    expect(page).toContain('<title>Tools &amp; &quot;tips&quot; &lt;2024&gt; $&amp; more</title>');
  });

  it('refuses a page that is not the app’s', () => {
    expect(() => publishedIndexHtml('<p>hello</p>', config)).toThrow();
  });

  it('keeps each site’s storage to the folder it is served from', () => {
    expect(siteStorageNamespace('https://someone.github.io/ai-map/')).toBe('site:/ai-map/:');
    expect(siteStorageNamespace('https://someone.github.io/ai-map/index.html?x=1#top')).toBe('site:/ai-map/:');
    expect(siteStorageNamespace('https://someone.github.io/other/')).not.toBe(
      siteStorageNamespace('https://someone.github.io/ai-map/'),
    );
  });
});

describe('the link to the paper', () => {
  it('turns a DOI into a doi.org link', () => {
    expect(paperLink('10.1145/3545945.3569759')).toBe('https://doi.org/10.1145/3545945.3569759');
    expect(paperLink('doi: 10.1145/3545945.3569759')).toBe('https://doi.org/10.1145/3545945.3569759');
  });

  it('takes a web address, with or without its scheme', () => {
    expect(paperLink('https://arxiv.org/abs/2401.00001')).toBe('https://arxiv.org/abs/2401.00001');
    expect(paperLink('arxiv.org/abs/2401.00001')).toBe('https://arxiv.org/abs/2401.00001');
  });

  it('is empty when nothing was typed, and refused when it is not an address', () => {
    expect(paperLink('  ')).toBe('');
    expect(paperLink('Smith et al. 2024')).toBeNull();
    expect(paperLink('javascript:alert(1)')).toBeNull();
  });
});
