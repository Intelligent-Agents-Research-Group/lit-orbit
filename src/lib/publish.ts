import { zipSync } from 'fflate';
import { DEV_SITE_BASE, SITE_CONFIG_FILE, SITE_FILES_MANIFEST } from '../config/publish';
import agentsTemplate from '../publish/agents.template.md?raw';
import readmeTemplate from '../publish/readme.template.txt?raw';
import { downloadBlob } from './export';
import { publishedIndexHtml, serialiseSiteConfig, type SiteConfig } from './site';
import { slug } from './text';

/**
 * Publishing: the app copying itself into a website of its own.
 *
 * A published site is this app as it is served - the files the build listed
 * in `SITE_FILES_MANIFEST` - with an index.html that names a site.json, and
 * that site.json beside it. It is put together here, in the browser, from the
 * files this page was served with, and handed over as a ZIP: nothing about the
 * batch goes anywhere but into the download.
 *
 * Loaded only when a site is published, so the ZIP writer and the texts below
 * stay out of the bundle everyone else downloads.
 */

/** For whoever publishes the site, not for its readers: `.gitignore` keeps them out of the repository. */
const README_FILE = 'README.txt';
const AGENTS_FILE = 'AGENTS.md';
const CLAUDE_FILE = 'CLAUDE.md';

/**
 * Every file of a published site, by path.
 *
 * `appFiles` is the app as this page was served, index.html among them;
 * `studioUrl` is where it was served from, which is where the site's author
 * comes back to change it.
 */
export function siteArchiveFiles(
  appFiles: ReadonlyMap<string, Uint8Array>,
  config: SiteConfig,
  studioUrl: string,
): Record<string, Uint8Array> {
  const index = appFiles.get('index.html');
  if (!index) throw new Error('The app has no index.html to publish.');
  const encoder = new TextEncoder();
  const title = config.title || 'Lit Orbit';
  const files: Record<string, Uint8Array> = Object.fromEntries(appFiles);
  files['index.html'] = encoder.encode(publishedIndexHtml(new TextDecoder().decode(index), config));
  files[SITE_CONFIG_FILE] = encoder.encode(serialiseSiteConfig(config));
  files[README_FILE] = encoder.encode(fill(readmeTemplate, { title, underline: '='.repeat(title.length), studioUrl }));
  files[AGENTS_FILE] = encoder.encode(fill(agentsTemplate, { title }));
  // Claude Code reads CLAUDE.md; one line brings in the AGENTS.md Codex reads.
  files[CLAUDE_FILE] = encoder.encode('@AGENTS.md\n');
  files['.gitignore'] = encoder.encode(
    ['# How to publish this folder, not part of the site.', README_FILE, AGENTS_FILE, CLAUDE_FILE, ''].join('\n'),
  );
  // GitHub Pages serves the files as they are, rather than through Jekyll.
  files['.nojekyll'] = new Uint8Array(0);
  return files;
}

/** What the download is called: the site's title, when it has any letters a file name can hold. */
export function siteArchiveName(title: string): string {
  return `${slug(title) || 'lit-orbit'}-site.zip`;
}

/**
 * Fetch the app's files from where this page came from, put the site together
 * and hand it to the browser to save.
 */
export async function downloadSite(config: SiteConfig, studioUrl: string): Promise<void> {
  // The development server has no build beside the page: it makes one to
  // publish from, and serves it apart.
  const base = import.meta.env.DEV ? DEV_SITE_BASE : import.meta.env.BASE_URL;
  const listed = await fetchManifest(base);
  const appFiles = new Map<string, Uint8Array>();
  await Promise.all(
    listed.map(async (path) => {
      // Revalidated rather than taken from the cache, so every file comes from
      // the same deploy as the list: an index.html from an older one would
      // name assets the list does not have.
      const response = await fetch(base + path.split('/').map(encodeURIComponent).join('/'), { cache: 'no-cache' });
      // A host that rewrites every path to index.html - ours does - answers a
      // missing file with the page instead of a 404.
      const page = !path.endsWith('.html') && response.headers.get('content-type')?.includes('text/html');
      if (!response.ok || page) throw new Error(`${path} could not be fetched from this server.`);
      appFiles.set(path, new Uint8Array(await response.arrayBuffer()));
    }),
  );
  const zipped = zipSync(siteArchiveFiles(appFiles, config, studioUrl));
  downloadBlob(new Blob([zipped.slice().buffer], { type: 'application/zip' }), siteArchiveName(config.title));
}

/** The list the build wrote down. */
async function fetchManifest(base: string): Promise<string[]> {
  const response = await fetch(base + SITE_FILES_MANIFEST, { cache: 'no-cache' });
  const listed: unknown = response.ok ? await response.json().catch(() => null) : null;
  if (!Array.isArray(listed) || !listed.every((path) => typeof path === 'string')) {
    throw new Error(
      import.meta.env.DEV
        ? 'the development server could not build the app to publish; the terminal it runs in says why.'
        : `${SITE_FILES_MANIFEST} is missing, so this copy of Lit Orbit cannot publish: it was not served from a build (npm run build).`,
    );
  }
  return listed;
}

/**
 * Put values into a template's `{{name}}` slots. The lines come out ending in
 * a bare line feed whatever the checkout gave the template file: git on
 * Windows may hand it over with carriage returns.
 */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\r\n/g, '\n').replace(/\{\{(\w+)\}\}/g, (slot, name: string) => values[name] ?? slot);
}
