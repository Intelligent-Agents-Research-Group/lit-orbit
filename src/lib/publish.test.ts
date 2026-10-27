import { describe, expect, it } from 'vitest';
import { buildDataset } from './dataset';
import { siteArchiveFiles, siteArchiveName } from './publish';
import { readSiteConfig, siteConfigFrom, type SiteConfig } from './site';

/** These check what goes into the ZIP a site is published as. The files are stand-ins. */

const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const APP_FILES = new Map<string, Uint8Array>([
  ['index.html', encode('<html><head><title>Lit Orbit</title></head><body></body></html>')],
  ['assets/index-abc123.js', encode('console.log("app")')],
  ['favicon.svg', encode('<svg/>')],
  ['LICENSE.txt', encode('MIT License')],
]);

function config(title = 'AI in CS1: an evidence map'): SiteConfig {
  const batch = buildDataset(
    'batch.csv',
    [
      { Title: 'A study', Design: 'RCT' },
      { Title: 'B study', Design: 'Survey' },
    ],
    'file',
  );
  return siteConfigFrom(
    {
      batch,
      columnRules: batch.rules,
      mapping: { labelKey: 'Title', wedgeKey: 'Design', colourKey: null, sizeKey: null, tierKey: null },
      filterKeys: [],
      tierSource: 'rules',
      tierRules: [],
      courseName: '',
    },
    { title, description: '', paper: { citation: '', url: '' }, madeWith: 'https://lit-orbit.example/' },
  );
}

describe('the published site', () => {
  const files = siteArchiveFiles(APP_FILES, config(), 'https://lit-orbit.example/');

  it('is the app, its site.json, and what its author needs to publish it', () => {
    expect(Object.keys(files).sort()).toEqual(
      [
        '.gitignore',
        '.nojekyll',
        'AGENTS.md',
        'CLAUDE.md',
        'LICENSE.txt',
        'README.txt',
        'assets/index-abc123.js',
        'favicon.svg',
        'index.html',
        'site.json',
      ].sort(),
    );
  });

  it('copies the app as it was served, except for its page', () => {
    expect(files['assets/index-abc123.js']).toBe(APP_FILES.get('assets/index-abc123.js'));
    expect(decode(files['index.html'])).toContain('<meta name="lit-orbit-site" content="site.json" />');
    expect(decode(files['index.html'])).toContain('<title>AI in CS1: an evidence map</title>');
  });

  it('holds a site.json the site can read', () => {
    const site = readSiteConfig(JSON.parse(decode(files['site.json'])));
    expect(site.batch.rows).toHaveLength(2);
  });

  it('fills in every slot of the instructions', () => {
    const readme = decode(files['README.txt']);
    const agents = decode(files['AGENTS.md']);
    expect(readme).toContain('https://lit-orbit.example/');
    expect(readme.split('\n').slice(0, 2)).toEqual(['AI in CS1: an evidence map', '='.repeat(26)]);
    expect(agents).toContain('"AI in CS1: an evidence map"');
    expect(readme + agents).not.toMatch(/\{\{\w+\}\}/);
  });

  it('points Claude Code at the instructions Codex reads', () => {
    expect(decode(files['CLAUDE.md'])).toBe('@AGENTS.md\n');
  });

  it('keeps the instructions out of the repository, and the site out of Jekyll', () => {
    const ignored = decode(files['.gitignore']).split('\n');
    expect(ignored).toEqual(expect.arrayContaining(['README.txt', 'AGENTS.md', 'CLAUDE.md']));
    expect(ignored).not.toContain('site.json');
    expect(files['.nojekyll']).toHaveLength(0);
  });

  it('needs the app’s page', () => {
    const withoutPage = new Map(APP_FILES);
    withoutPage.delete('index.html');
    expect(() => siteArchiveFiles(withoutPage, config(), 'https://lit-orbit.example/')).toThrow('index.html');
  });
});

describe('the name of the download', () => {
  it('is the title, made safe for a file name', () => {
    expect(siteArchiveName('AI in CS1: an evidence map')).toBe('ai-in-cs1-an-evidence-map-site.zip');
  });

  it('falls back to Lit Orbit when nothing of the title survives', () => {
    // A title in a script a file name here cannot hold, built from code
    // points so the source stays in English.
    const unwritable = String.fromCharCode(0x6587, 0x732e, 0x5730, 0x56fe);
    expect(siteArchiveName(unwritable + ' AI')).toBe('ai-site.zip');
    expect(siteArchiveName(unwritable)).toBe('lit-orbit-site.zip');
  });
});
