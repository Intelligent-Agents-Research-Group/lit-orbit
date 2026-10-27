// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { STORAGE_KEYS } from './config/defaults';
import { presetFromWorkbook } from './data/base';
import { EXAMPLE_SETUP } from './data/example';
import { findColumn } from './data/model';
import type { Preset } from './data/preset';
import { readDataset } from './lib/dataset';
import { serialiseSiteConfig, siteConfigFrom, SITE_FORMAT, type SiteInfo } from './lib/site';
import { storageKey } from './lib/storage';
import { formatUrlState } from './lib/urlState';

/**
 * The app as a whole: which screen comes up, and what it does with what this
 * browser kept and what the address names. The parts underneath have tests
 * of their own; these are about the decisions App makes between them.
 *
 * The orbit itself is not drawn - jsdom has no canvas, and OrbitCanvas leaves
 * a canvas it cannot draw on blank - so what is checked is the text around it.
 */

/** The example as the app opens it, read once: reading the workbook is the slow part. */
let example: Preset;
/** A column "Your course" starts with in the example, and a value it holds. */
let filterKey: string;
let filterValue: string;

beforeAll(async () => {
  stubBrowser();
  // Read from the project root, where Vitest runs: under jsdom `import.meta.url` is not a file path.
  const bytes = readFileSync(`public/${EXAMPLE_SETUP.file}`);
  example = await presetFromWorkbook(new File([bytes], EXAMPLE_SETUP.file), EXAMPLE_SETUP);
  filterKey = example.filterKeys[0];
  const values = findColumn(readDataset(example.batch, example.batch.rules), filterKey)?.values ?? [];
  filterValue = values[0];
  expect(filterValue).toBeDefined();
});

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
});

afterEach(cleanup);

/** jsdom lacks a few of the browser APIs the app touches on the way to a canvas it cannot draw on. */
function stubBrowser() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  // jsdom reports every call as "not implemented"; null is what a browser
  // without a 2D context would answer, and the orbit then stays blank.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

/** Put a value where the app stores it, as the app would write it. */
function store(role: keyof typeof STORAGE_KEYS, value: unknown) {
  localStorage.setItem(storageKey(role), JSON.stringify(value));
}

function renderApp(site: SiteInfo | null = null) {
  return render(<App preset={example} site={site} kept={null} />);
}

/** The line over the orbit that says how many settings the dots are matched on. */
function matchingLine() {
  return screen.getByText(/^Matching on/);
}

const CSV = [
  'title,role,direction,year',
  'Study A,Tutor,Positive,2021',
  'Study B,Grader,Negative,2022',
  'Study C,Tutor,Mixed,2023',
].join('\n');

/** A tools column that two coders separated two ways, so the file check has something to say. */
const MIXED_CSV = [
  'title,tools',
  ...['A; B', 'B; C', 'A; C', 'A; B; C', 'A, B', 'B, C', 'A, C', 'A, B, C', 'A', 'B'].map(
    (tools, index) => `Study ${index + 1},"${tools}"`,
  ),
].join('\n');

/** The landing page offers its two ways in twice - at the top, and again at the foot - so either will do. */
function landingButton(name: 'Build your own' | 'View an example') {
  return screen.getAllByRole('button', { name })[0];
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('No file input on this screen.');
  return input;
}

describe('the screen that comes up', () => {
  it('is the landing page when nothing is stored', () => {
    renderApp();
    expect(landingButton('Build your own')).toBeTruthy();
    expect(landingButton('View an example')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'When to reach for Lit Orbit' })).toBeTruthy();
    // Nothing was open before, so there is nothing to go back to.
    expect(screen.queryByRole('button', { name: 'Back to what I had open' })).toBeNull();
  });

  it('is the orbit once the example is chosen, and stays the orbit after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    await user.click(landingButton('View an example'));
    expect(screen.getByText('Example batch')).toBeTruthy();
    expect(matchingLine()).toBeTruthy();
    // The example is set up already: it has no setup pages and is not the user's to publish.
    expect(screen.queryByRole('button', { name: 'Edit setup' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish as a website' })).toBeNull();

    unmount();
    renderApp();
    expect(screen.getByText('Example batch')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'View an example' })).toHaveLength(0);
  });

  it('is the landing page, saying why, when the batch this browser was keeping is gone', () => {
    // The small keys survived and the batch did not: what a refused write leaves behind.
    store('dataMode', 'own');
    renderApp();
    expect(screen.getByText(/too large for this browser to keep/)).toBeTruthy();
    // Falling back to the example would show other people's studies under the user's settings.
    expect(screen.queryByText('Example batch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to what I had open' })).toBeNull();
  });

  it('goes back to the open orbit from the landing page, with nothing changed', async () => {
    const user = userEvent.setup();
    store('dataMode', 'base');
    store('filters', { [filterKey]: [filterValue] });
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Change data source' }));
    await user.click(screen.getByRole('button', { name: 'Back to what I had open' }));
    expect(matchingLine().textContent).toMatch(/Matching on 1 setting\b/);
  });
});

describe('building your own', () => {
  it('sets a loaded file up on three pages, then draws it', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await user.click(landingButton('Build your own'));
    expect(screen.getByRole('heading', { name: 'Your course and your batch' })).toBeTruthy();
    // The later pages are named by columns the first one decides, so they wait for a file.
    expect(screen.getByRole('button', { name: /Next: your columns/ }).hasAttribute('disabled')).toBe(true);

    await user.type(screen.getByLabelText(/Course name/), 'CS1 with an AI tutor');
    await user.upload(fileInput(container), new File([CSV], 'batch.csv', { type: 'text/csv' }));
    const next = await screen.findByRole('button', { name: /Next: your columns/ });
    expect(next.hasAttribute('disabled')).toBe(false);
    // A tidy file: nothing for the file check to say.
    expect(screen.getByText(/^Nothing stood out/)).toBeTruthy();

    await user.click(next);
    expect(screen.getByRole('heading', { name: 'How each column is read' })).toBeTruthy();
    // The first column is shown in detail until another rule is clicked - by
    // its name here, since a column with one way to read it has no dropdown to click.
    expect(screen.getByRole('heading', { name: 'title reads as' })).toBeTruthy();
    await user.click(screen.getByText('role', { selector: 'li > * > span' }));
    expect(screen.getByRole('heading', { name: 'role reads as' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Next: your orbit/ }));
    expect(screen.getByRole('heading', { name: 'Your orbit' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Show the orbit' }));

    expect(screen.getByRole('button', { name: 'Edit setup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish as a website' })).toBeTruthy();
    expect(screen.getByText('batch.csv')).toBeTruthy();
    expect(screen.getByText(/^3 studies · 4 columns/)).toBeTruthy();
    // A new file keeps the user's course: it is about them, not about the file.
    expect(JSON.parse(localStorage.getItem(storageKey('courseName')) ?? 'null')).toBe('CS1 with an AI tutor');
  });

  it('takes up a published site again from its site.json, with everything its author chose', async () => {
    const user = userEvent.setup();
    const config = siteConfigFrom(
      { ...example, columnRules: example.batch.rules, courseName: 'Intro programming' },
      { title: 'A map', description: '', paper: { citation: '', url: '' }, madeWith: '' },
    );
    const { container } = renderApp();
    await user.click(landingButton('Build your own'));
    await user.upload(fileInput(container), new File([serialiseSiteConfig(config)], 'site.json'));

    // A site.json is not a table to be read: it comes back set up.
    const course = await screen.findByDisplayValue('Intro programming');
    expect(course).toBeTruthy();
    expect(screen.getByText(new RegExp(`^${example.batch.rows.length} studies`))).toBeTruthy();
  });

  it('refuses a site.json from a newer Lit Orbit, saying why, rather than reading it as a table', async () => {
    const user = userEvent.setup();
    const config = siteConfigFrom(
      { ...example, columnRules: example.batch.rules, courseName: '' },
      { title: '', description: '', paper: { citation: '', url: '' }, madeWith: '' },
    );
    const newer = serialiseSiteConfig(config).replace(`"format": ${SITE_FORMAT}`, `"format": ${SITE_FORMAT + 1}`);
    const { container } = renderApp();
    await user.click(landingButton('Build your own'));
    await user.upload(fileInput(container), new File([newer], 'site.json'));

    expect(await screen.findByText(/written by a newer Lit Orbit/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Next: your columns/ }).hasAttribute('disabled')).toBe(true);
  });

  it('says what the reader made of an awkward file, and writes the instruction that puts it right', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await user.click(landingButton('Build your own'));
    await user.upload(fileInput(container), new File([MIXED_CSV], 'mixed.csv', { type: 'text/csv' }));

    // In the list of findings; the instruction under it says the same, in a box of its own.
    expect(await screen.findByText(/uses both a semicolon and a comma/, { selector: 'li' })).toBeTruthy();
    const instruction = screen.getByLabelText('Instruction for an AI assistant') as HTMLTextAreaElement;
    expect(instruction.value).toContain('Name: mixed.csv (a CSV file)');
    expect(instruction.value).toContain('1. "tools" uses both a semicolon and a comma');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    // The tabs ask for the same changes as different kinds of code.
    expect(instruction.value).toContain('python reshape_for_lit_orbit.py');
    await user.click(screen.getByRole('tab', { name: 'Google Colab' }));
    expect(instruction.value).toContain('files.upload()');
    expect(screen.getByRole('tab', { name: 'Google Colab' }).getAttribute('aria-selected')).toBe('true');

    // What the separators do is the user's to say, so the AI is told to ask them.
    expect(instruction.value).toContain('Ask me what each of a semicolon and a comma does in this column');

    // The same finding waits under the column's rule on the next page.
    await user.click(screen.getByRole('button', { name: /Next: your columns/ }));
    expect(screen.getByText(/^Uses both a semicolon and a comma/)).toBeTruthy();
  });
});

describe('the settings of "Your course"', () => {
  beforeEach(() => store('dataMode', 'base'));

  it('count a stored value only while its column still holds it', () => {
    store('filters', { [filterKey]: ['a value no study has'] });
    renderApp();
    expect(matchingLine().textContent).toMatch(/Matching on 0 settings/);
  });

  it('count a stored value its column holds', () => {
    store('filters', { [filterKey]: [filterValue] });
    renderApp();
    expect(matchingLine().textContent).toMatch(/Matching on 1 setting\b/);
  });

  it('drop out while their column plays a role in the orbit, and come back after', () => {
    store('filters', { [filterKey]: [filterValue] });
    store('mapping', { ...example.mapping, colourKey: filterKey });
    const { unmount } = renderApp();
    expect(matchingLine().textContent).toMatch(/Matching on 0 settings/);
    unmount();

    store('mapping', example.mapping);
    renderApp();
    expect(matchingLine().textContent).toMatch(/Matching on 1 setting\b/);
  });

  it('come from the address when a link names them, over what this browser kept', () => {
    store('filters', {});
    history.replaceState(null, '', formatUrlState({ filters: { [filterKey]: [filterValue] }, study: null }));
    renderApp();
    expect(matchingLine().textContent).toMatch(/Matching on 1 setting\b/);
  });

  it('are written into the address, so it always links to the view on screen', () => {
    store('filters', { [filterKey]: [filterValue], 'not a column': ['x'] });
    renderApp();
    // Only what survived the pruning: a link never names a setting the page is not showing.
    expect(location.hash).toBe(formatUrlState({ filters: { [filterKey]: [filterValue] }, study: null }));
  });
});

describe('clearing stored data', () => {
  it('forgets the batch and its setup, keeps the light / dark choice, and starts over', async () => {
    const user = userEvent.setup();
    store('dataMode', 'base');
    store('filters', { [filterKey]: [filterValue] });
    store('courseName', 'Mine');
    localStorage.setItem(STORAGE_KEYS.appearance, 'dark');
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Change data source' }));
    await user.click(screen.getByRole('button', { name: 'Clear stored data' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(landingButton('View an example')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to what I had open' })).toBeNull();
    for (const role of ['dataMode', 'filters', 'courseName'] as const) {
      expect(localStorage.getItem(storageKey(role))).toBeNull();
    }
    expect(localStorage.getItem(STORAGE_KEYS.appearance)).toBe('dark');
  });
});

describe('a published site', () => {
  const site: SiteInfo = {
    title: 'GenAI tutors in CS1',
    description: 'Every study we reviewed.',
    paper: { citation: '', url: 'https://example.org/paper' },
    madeWith: '',
  };

  it('opens on its own batch, read-only, whatever this browser kept', () => {
    // What our own app would have kept: none of it may reach the site.
    store('dataMode', 'own');
    store('mapping', { ...example.mapping, wedgeKey: null });
    renderApp(site);

    expect(screen.getByRole('heading', { level: 1, name: site.title })).toBeTruthy();
    // In the header and again in the panel about the map: both lead to the paper.
    for (const link of screen.getAllByRole('link', { name: 'Read the paper' })) {
      expect(link.getAttribute('href')).toBe(site.paper.url);
    }
    // No way to another batch, and nothing of the author's setup to change.
    for (const name of ['Change data source', 'Edit setup', 'Publish as a website', 'Load another file']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.getByText(/The author of this map set the rings/)).toBeTruthy();
    expect(screen.getByText(site.description)).toBeTruthy();
  });

  it('still lets a visitor set their own course', () => {
    history.replaceState(null, '', formatUrlState({ filters: { [filterKey]: [filterValue] }, study: null }));
    renderApp(site);
    expect(matchingLine().textContent).toMatch(/Matching on 1 setting\b/);
  });
});
