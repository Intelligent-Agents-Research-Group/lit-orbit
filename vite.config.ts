import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {
  DEV_SITE_BASE,
  SITE_FILES_MANIFEST,
  SITE_LICENSE_FILE,
  SITE_PUBLIC_FILES,
  THIRD_PARTY_LICENSES_FILE,
} from './src/config/publish.ts';

// https://vite.dev/config/
export default defineConfig({
  // Relative, so the built app runs from whatever folder serves it:
  // `/<repository>/` on GitHub Pages, where this app and every site published
  // from it live, or the root of any other host.
  base: './',
  build: {
    // The libraries in the bundle come with licences, and those travel with
    // it - into every site published from it as well.
    license: { fileName: THIRD_PARTY_LICENSES_FILE },
  },
  plugins: [react(), publishableSite(), publishFromDevServer()],
});

/**
 * Write down which files a published site is made of (see
 * `src/config/publish.ts`), and put Lit Orbit's own licence among them.
 *
 * The list is the bundle - index.html and everything under assets/ - plus the
 * public files `SITE_PUBLIC_FILES` names. It runs after Vite's own plugins, so
 * the licences of the bundled libraries are already there to be listed.
 */
function publishableSite(): Plugin {
  let root = '';
  let publicDir = '';
  return {
    name: 'lit-orbit:publishable-site',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        this.emitFile({
          type: 'asset',
          fileName: SITE_LICENSE_FILE,
          source: readFileSync(join(root, 'LICENSE'), 'utf8'),
        });

        for (const needed of ['index.html', THIRD_PARTY_LICENSES_FILE]) {
          if (!(needed in bundle)) this.error(`${needed} is not in the bundle, so a published site would lack it.`);
        }
        const absent = SITE_PUBLIC_FILES.filter((file) => !existsSync(join(publicDir, file)));
        if (absent.length > 0) this.error(`SITE_PUBLIC_FILES names files public/ does not have: ${absent.join(', ')}.`);

        const files = [...new Set([...Object.keys(bundle), SITE_LICENSE_FILE, ...SITE_PUBLIC_FILES])].sort();
        const hidden = files.filter(hiddenFromPages);
        if (hidden.length > 0) {
          this.error(`GitHub Pages would leave out ${hidden.join(', ')}: rename them so no part starts with _ or .`);
        }
        this.emitFile({
          type: 'asset',
          fileName: SITE_FILES_MANIFEST,
          source: JSON.stringify(files, null, 2) + '\n',
        });
      },
    },
  };
}

/**
 * Let the development server publish a site as well. It has no build to copy -
 * it serves the source a module at a time - so when a site's file list is
 * asked for, it builds the app the way `npm run build` does, into a folder of
 * its own, and serves that build under `DEV_SITE_BASE`. Every publish builds
 * afresh, so the site is made of the source as it is at that moment.
 */
function publishFromDevServer(): Plugin {
  return {
    name: 'lit-orbit:publish-from-dev-server',
    apply: 'serve',
    configureServer(server) {
      const { root, cacheDir, logger } = server.config;
      const outDir = join(cacheDir, 'site');
      // One build at a time: a second publish waits on the one under way.
      let building: Promise<void> | null = null;

      server.middlewares.use(DEV_SITE_BASE, (request, response, next) => {
        const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname).slice(1);
        const file = resolve(outDir, path);
        // Files of the build only: nothing above it, nothing on another drive.
        if (!file.startsWith(outDir + sep)) return next();
        const serve = async () => {
          if (path === SITE_FILES_MANIFEST) {
            logger.info('Building the app to publish a site from it...', { timestamp: true });
            building ??= buildInChild(root, outDir).finally(() => {
              building = null;
            });
            await building;
          }
          if (!existsSync(file)) {
            response.statusCode = 404;
            response.end();
            return;
          }
          response.setHeader('Content-Type', path.endsWith('.json') ? 'application/json' : 'application/octet-stream');
          response.end(readFileSync(file));
        };
        serve().catch(next);
      });
    },
  };
}

/**
 * Run `vite build` into `outDir`, in a process of its own: the development
 * server has set NODE_ENV to "development" for itself, and a build that
 * inherited it would come out as a development build.
 */
function buildInChild(root: string, outDir: string): Promise<void> {
  return new Promise((done, fail) => {
    const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'inherit',
    });
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0 ? done() : fail(new Error(`The build to publish from failed (exit code ${code}).`)),
    );
  });
}

/**
 * GitHub Pages runs a site through Jekyll unless the site opts out, and Jekyll
 * leaves out every file or folder whose name starts with `_`, `.` or `#`, or
 * ends in `~`. A published site does ship a `.nojekyll` to opt out, but a
 * folder dragged onto GitHub's upload page leaves its dotfiles behind, so
 * nothing may depend on it.
 */
function hiddenFromPages(path: string): boolean {
  return path.split('/').some((part) => /^[_.#]/.test(part) || part.endsWith('~'));
}
