import { useState } from 'react';
import type { Preset } from './data/preset';
import { useAppearance } from './hooks/useAppearance';
import { useBatchLoader } from './hooks/useBatchLoader';
import { useLinkedView } from './hooks/useLinkedView';
import { useStoredSetup } from './hooks/useStoredSetup';
import type { KeptImport } from './lib/importStore';
import type { SiteInfo } from './lib/site';
import { parseUrlState } from './lib/urlState';
import { Landing } from './components/Landing';
import { OrbitScreen } from './components/OrbitScreen';
import { Setup, type SetupStep } from './components/Setup';

/** Shown on the landing page when the batch this browser was keeping is gone. */
const BATCH_LOST =
  'The batch you loaded was too large for this browser to keep, so it is not here any more. Nothing of it was sent anywhere; load the file again to pick up where you left off.';

/**
 * Which screen is up. The landing page and the three setup pages each stand
 * in for the whole app; `orbit` is the app itself.
 */
type Screen = 'landing' | SetupStep | 'orbit';

/**
 * The root: which screen is up, and the state every screen shares.
 *
 * That state lives in three hooks rather than in a store. `useStoredSetup`
 * keeps the batch and every choice about it in this browser and derives the
 * orbit from them - the nearest thing here to a Vue store; `useBatchLoader`
 * reads files into it; `useLinkedView` keeps the address bar in step with the
 * view. Each screen gets what it needs as props and reports back through
 * callbacks: React's version of Vue's "props down, events up".
 *
 * The batch that comes set up - our example, or on a published site the
 * site's own - arrives as a prop because it is read from a file rather than
 * from code: `main.tsx` fetches it before the first render. `site` is set on a
 * published site, and only there. `kept` is the file this browser kept from
 * the last visit, read back the same way, and only in our own app.
 */
export default function App({
  preset,
  site,
  kept,
}: {
  preset: Preset;
  site: SiteInfo | null;
  kept: KeptImport | null;
}) {
  const published = site !== null;
  // The view the page was opened on, when its address names one: a link
  // someone shared. Read once, before anything is stored or drawn, so it beats
  // what this browser remembers.
  const [linked] = useState(() => parseUrlState(location.hash));
  const setup = useStoredSetup({ preset, published, kept, linkedFilters: linked.filters });
  const [focusedRowId, setFocusedRowId] = useLinkedView(linked.study, setup.course.filters, setup.course.setFilters);
  // Not kept: a reload with a batch chosen goes back to the orbit, and one
  // without goes to the landing page.
  const [screen, setScreen] = useState<Screen>(() => (setup.dataMode === null ? 'landing' : 'orbit'));
  const loader = useBatchLoader({
    setup,
    kept,
    // The study open in the panel was a row of the batch that has just been
    // replaced, so it closes with it.
    onBatchChange: (destination) => {
      setFocusedRowId(null);
      if (destination) setScreen(destination);
    },
  });
  const [appearance, toggleAppearance] = useAppearance();

  /** Forget what this browser has kept and return to the landing page. */
  const forgetStoredData = () => {
    loader.chooseBaseBatch();
    setup.forget();
    setScreen('landing');
  };

  const shown = screenToShow({
    published,
    screen,
    dataMode: setup.dataMode,
    batchLost: setup.batchLost,
    ownBatch: setup.dataset.source === 'file',
  });

  if (shown === 'landing') {
    return (
      <Landing
        appearance={appearance}
        baseSize={preset.batch.rows.length}
        error={setup.batchLost ? BATCH_LOST : null}
        onDismiss={setup.dataMode === null || setup.batchLost ? undefined : () => setScreen('orbit')}
        onToggleAppearance={toggleAppearance}
        onViewExample={loader.chooseBaseBatch}
        onBuildOwn={() => {
          loader.clearError();
          setScreen('data');
        }}
        onClearStoredData={forgetStoredData}
      />
    );
  }

  if (shown === 'data' || shown === 'columns' || shown === 'settings') {
    return (
      <Setup
        step={shown}
        setup={setup}
        loader={loader}
        appearance={appearance}
        onToggleAppearance={toggleAppearance}
        onStepChange={setScreen}
        onExit={() => setScreen('landing')}
        onDone={() => setScreen('orbit')}
      />
    );
  }

  return (
    <OrbitScreen
      setup={setup}
      loader={loader}
      site={site}
      appearance={appearance}
      onToggleAppearance={toggleAppearance}
      focusedRowId={focusedRowId}
      onFocus={setFocusedRowId}
      onChangeSource={() => setScreen('landing')}
      onOpenSetup={() => setScreen('data')}
    />
  );
}

/**
 * The screen that can be shown, given the one asked for. The first setup page
 * is where a file is loaded, so it is open with no batch chosen yet; the orbit
 * and the later pages are not, and fall back to the landing page. So does a
 * lost batch - unless the user is on the first page, loading it again.
 */
function screenToShow({
  published,
  screen,
  dataMode,
  batchLost,
  ownBatch,
}: {
  published: boolean;
  screen: Screen;
  dataMode: 'base' | 'own' | null;
  batchLost: boolean;
  ownBatch: boolean;
}): Screen {
  // A published site is its orbit, and nothing else.
  if (published) return 'orbit';
  if (screen === 'data') return 'data';
  if (dataMode === null || batchLost) return 'landing';
  // The later pages are named by the columns of the user's own file, so the
  // example has none to show.
  if ((screen === 'columns' || screen === 'settings') && !ownBatch) return 'data';
  return screen;
}
