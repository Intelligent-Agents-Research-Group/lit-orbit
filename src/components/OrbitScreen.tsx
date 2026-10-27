import { useRef, useState, type CSSProperties } from 'react';
import { PANEL_WIDTH_LIMITS } from '../config/defaults';
import type { BatchLoader } from '../hooks/useBatchLoader';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import type { StoredSetup } from '../hooks/useStoredSetup';
import type { Appearance } from '../lib/appearance';
import type { SiteInfo } from '../lib/site';
import { storageKey } from '../lib/storage';
import { Header } from './Header';
import { PublishDialog } from './PublishDialog';
import { OrbitCanvas } from './orbit/OrbitCanvas';
import { DataPanel } from './panels/DataPanel';
import { DetailPanel } from './panels/DetailPanel';
import { FilterPanel } from './panels/FilterPanel';
import { SiteAbout } from './panels/SiteAbout';
import { TierPanel } from './panels/TierPanel';
import { Resizer } from './ui/Resizer';
import styles from './OrbitScreen.module.css';

interface OrbitScreenProps {
  setup: StoredSetup;
  loader: BatchLoader;
  /** What a published site says about itself; set on a published site, and only there. */
  site: SiteInfo | null;
  appearance: Appearance;
  onToggleAppearance: () => void;
  /** Row id of the study open in the panel. */
  focusedRowId: number | null;
  onFocus: (rowId: number | null) => void;
  /** Back to the landing page. */
  onChangeSource: () => void;
  /** Reopens the first setup page. */
  onOpenSetup: () => void;
}

/**
 * The app itself: the settings in a rail on the left, the orbit in the
 * middle, the studies in a panel on the right, under a header. On a published
 * site the rail says what the map is instead of how its batch is read, and
 * the header offers no way to another batch.
 */
export function OrbitScreen({
  setup,
  loader,
  site,
  appearance,
  onToggleAppearance,
  focusedRowId,
  onFocus,
  onChangeSource,
  onOpenSetup,
}: OrbitScreenProps) {
  const { dataset, columns, course, tiers, model, centreLabel } = setup;
  const published = site !== null;
  const ownBatch = dataset.source === 'file';

  // Panel widths: `null` means "the width the token gives", so a panel that
  // was never dragged follows a change to `tokens.css` rather than pinning the
  // width this browser happened to store.
  const [railWidth, setRailWidth] = useLocalStorageState<number | null>(storageKey('railWidth'), null);
  const [detailWidth, setDetailWidth] = useLocalStorageState<number | null>(storageKey('detailWidth'), null);
  const [publishing, setPublishing] = useState(false);
  // The panels are measured while they are dragged, so each one hands its DOM
  // node to its handle.
  const railRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  // A dragged width is written back into the layout token it overrides, so the
  // grid column, the panel and its handle keep moving together. `undefined`
  // leaves the token alone, which is what an un-dragged panel wants.
  const panelWidths = {
    '--layout-rail-width': railWidth === null ? undefined : railWidth + 'px',
    '--layout-detail-width': detailWidth === null ? undefined : detailWidth + 'px',
  } as CSSProperties;

  return (
    <div className={styles.app} style={panelWidths}>
      <Header
        mode={published ? 'site' : ownBatch ? 'own' : 'example'}
        site={site}
        appearance={appearance}
        onToggleAppearance={onToggleAppearance}
        onChangeSource={onChangeSource}
        onOpenSetup={onOpenSetup}
        onPublish={() => setPublishing(true)}
      />
      <aside className={styles.rail} ref={railRef}>
        {site ? (
          <SiteAbout site={site} dataset={dataset} />
        ) : (
          <DataPanel dataset={dataset} columns={columns} loader={loader} />
        )}
        <FilterPanel dataset={dataset} mapping={columns.mapping} course={course} />
        <TierPanel locked={published ? 'site' : ownBatch ? null : 'example'} dataset={dataset} tiers={tiers} />
      </aside>
      <Resizer
        className={styles.railHandle}
        panelRef={railRef}
        edge="end"
        label="the settings panel"
        min={PANEL_WIDTH_LIMITS.rail.min}
        max={PANEL_WIDTH_LIMITS.rail.max}
        onResize={setRailWidth}
        onReset={() => setRailWidth(null)}
      />
      <main className={styles.stage}>
        <OrbitCanvas
          model={model}
          appearance={appearance}
          focusedRowId={focusedRowId}
          centreLabel={centreLabel}
          colourLabel={columns.mapping.colourKey}
          onFocus={onFocus}
        />
      </main>
      <Resizer
        className={styles.detailHandle}
        panelRef={detailRef}
        edge="start"
        label="the study table"
        min={PANEL_WIDTH_LIMITS.detail.min}
        max={PANEL_WIDTH_LIMITS.detail.max}
        onResize={setDetailWidth}
        onReset={() => setDetailWidth(null)}
      />
      <aside className={styles.detail} ref={detailRef}>
        <DetailPanel
          model={model}
          dataset={dataset}
          mapping={columns.mapping}
          filterKeys={course.keys}
          filters={course.filters}
          focusedRowId={focusedRowId}
          onFocus={onFocus}
        />
      </aside>
      {publishing && (
        <PublishDialog
          setup={{
            batch: setup.batch,
            columnRules: columns.rules,
            mapping: columns.mapping,
            filterKeys: course.keys,
            tierSource: tiers.source,
            tierRules: tiers.rules,
            courseName: setup.courseName,
          }}
          draft={setup.publishDraft}
          onDraftChange={setup.setPublishDraft}
          onClose={() => setPublishing(false)}
        />
      )}
    </div>
  );
}
