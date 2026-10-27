import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { SITE_MARKER } from './config/publish';
import { applyAppearance, initialAppearance } from './lib/appearance';
import { loadExample } from './data/base';
import type { Preset } from './data/preset';
import { restoreKeptImport, type KeptImport } from './lib/importStore';
import { loadSite, presetFromSite, siteStorageNamespace, type SiteInfo } from './lib/site';
import { setStorageNamespace } from './lib/storage';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NarrowWindowDialog } from './components/NarrowWindowDialog';
import { StartupError } from './components/StartupError';

// Before the first paint, so the page never flashes the light palette.
applyAppearance(initialAppearance());

const root = createRoot(document.getElementById('root')!);

/**
 * A site published from Lit Orbit is this same app, with a marker in its
 * index.html naming the site.json that holds its batch. Our own page has no
 * marker, so it is told apart before anything has been fetched - a missing
 * site.json is then an error to report, not a sign that this is our page.
 */
const siteFile = document.querySelector<HTMLMetaElement>(`meta[name="${SITE_MARKER}"]`)?.content || null;

/**
 * The batch - ours, or the site's - is read before the first render: the
 * start screen already counts its studies, and every other screen draws them.
 * So is the file the last visit loaded, when this browser kept it: a
 * published site loads no files, so only our own app looks.
 */
async function start() {
  try {
    let preset: Preset;
    let site: SiteInfo | null = null;
    let kept: KeptImport | null = null;
    if (siteFile) {
      const config = await loadSite(siteFile);
      // Before the first render, which is when the app reads what it stored.
      setStorageNamespace(siteStorageNamespace(location.href));
      preset = presetFromSite(config);
      site = { title: config.title, description: config.description, paper: config.paper, madeWith: config.madeWith };
    } else {
      const [example, restored] = await Promise.all([loadExample(), restoreKeptImport()]);
      preset = example;
      kept = restored;
    }
    root.render(
      <StrictMode>
        {/* Inside the boundary, so a throw from any screen ends in a card with
            a way out rather than in an empty page. */}
        <ErrorBoundary>
          <App preset={preset} site={site} kept={kept} />
        </ErrorBoundary>
        {/* Outside the app: it floats over whichever screen is showing. */}
        <NarrowWindowDialog />
      </StrictMode>,
    );
  } catch (cause) {
    root.render(
      <StrictMode>
        <StartupError message={cause instanceof Error ? cause.message : String(cause)} published={siteFile !== null} />
      </StrictMode>,
    );
  }
}

void start();
