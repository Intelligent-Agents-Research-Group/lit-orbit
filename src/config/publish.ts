/**
 * The files a published site is made of. Shared by the build, which writes
 * them (see `vite.config.ts`), and by the app, which copies them into a site
 * of their own (see `lib/publish.ts`) - so this module holds nothing but
 * names, and nothing that needs a browser.
 */

/**
 * Written by the build next to index.html: every file of the app a published
 * site needs. A page cannot list the folder it is served from, so the build
 * writes the list down.
 */
export const SITE_FILES_MANIFEST = 'site-files.json';

/**
 * Where the development server hands out a build of the app to publish. It
 * serves the source a module at a time and has no build of its own, so it
 * makes one when a site is published (see `vite.config.ts`), and serves it
 * here rather than beside the page, where its own index.html already is.
 */
export const DEV_SITE_BASE = '/@lit-orbit-site/';

/** The batch of a published site and how it is read, next to its index.html. */
export const SITE_CONFIG_FILE = 'site.json';

/**
 * The name of the `<meta>` a published site's index.html carries, naming its
 * `site.json`. Our own index.html has none, which is how the app tells the two
 * apart before it has read anything.
 */
export const SITE_MARKER = 'lit-orbit-site';

/** Lit Orbit's own licence, copied from the repository root by the build. */
export const SITE_LICENSE_FILE = 'LICENSE.txt';

/** The licences of the libraries the build bundles, written by Vite. */
export const THIRD_PARTY_LICENSES_FILE = 'THIRD-PARTY-LICENSES.md';

/**
 * The files in `public/` a published site needs. Named rather than taken
 * wholesale: `public/` also holds the example batch, which is ours and has no
 * place in someone else's site.
 */
export const SITE_PUBLIC_FILES: readonly string[] = ['favicon.svg'];
