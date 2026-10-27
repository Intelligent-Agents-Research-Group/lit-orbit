import { useState, type CSSProperties } from 'react';
import { LIST_PREVIEW_SIZE } from '../../config/defaults';
import { cellText, type ColumnMapping, type Dataset } from '../../data/model';
import { cx } from '../../lib/cx';
import { filterableColumns } from '../../lib/dataset';
import type { OrbitModel, OrbitNode } from '../../lib/layout';
import { activeFilters, type FilterState } from '../../lib/matching';
import { categoryColourVar } from '../../lib/theme';
import { prettyKey } from '../../lib/text';
import { Button } from '../ui/Button';
import { DownloadStudies } from './DownloadStudies';
import styles from './DetailPanel.module.css';

interface DetailPanelProps {
  model: OrbitModel;
  dataset: Dataset;
  mapping: ColumnMapping;
  /** The columns of "Your course", in panel order: they are the table's columns. */
  filterKeys: string[];
  filters: FilterState;
  focusedRowId: number | null;
  onFocus: (rowId: number | null) => void;
}

/**
 * Right-hand panel. It shows one of three things:
 *
 * - the card of the study that was clicked;
 * - the batch ranked by how much of the course each study shares, as a table
 *   of the settings, once any setting is on;
 * - the whole batch as a plain list, when no setting is on and there is
 *   nothing to lay out in columns.
 */
export function DetailPanel({ model, dataset, mapping, filterKeys, filters, focusedRowId, onFocus }: DetailPanelProps) {
  const focused = focusedRowId === null ? undefined : model.nodes.find((node) => node.study.rowId === focusedRowId);
  if (focused) {
    return (
      <StudyCard
        node={focused}
        dataset={dataset}
        mapping={mapping}
        activeFilterCount={model.activeFilterCount}
        onBack={() => onFocus(null)}
      />
    );
  }
  if (model.activeFilterCount > 0) {
    return <StudyTable model={model} dataset={dataset} filterKeys={filterKeys} filters={filters} onFocus={onFocus} />;
  }
  return <StudyList model={model} dataset={dataset} onFocus={onFocus} />;
}

/** Order the panel lists studies in: best evidence first, then by name. */
function byTierThenName(a: OrbitNode, b: OrbitNode): number {
  return a.tier - b.tier || a.study.label.localeCompare(b.study.label);
}

/**
 * Order the table uses once the course is set: how much of it a study shares,
 * then the same tie-breaks as the list.
 *
 * This is the order the orbit draws in - full matches solid, near misses
 * half-transparent, the rest left off - so the picture and the table answer
 * the same question the same way round.
 */
function byMatchThenTier(a: OrbitNode, b: OrbitNode): number {
  return b.match - a.match || byTierThenName(a, b);
}

/** The whole batch as a plain list: nothing is set, so there is nothing to tabulate. */
function StudyList({
  model,
  dataset,
  onFocus,
}: {
  model: OrbitModel;
  dataset: Dataset;
  onFocus: (rowId: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const ranked = [...model.nodes].sort(byTierThenName);
  const visible = showAll ? ranked : ranked.slice(0, LIST_PREVIEW_SIZE);

  return (
    <>
      <header className={styles.panelHeader}>
        <h2 className={styles.title}>All studies</h2>
      </header>
      {ranked.length > 0 && <DownloadStudies nodes={ranked} dataset={dataset} filtered={false} />}
      <ul className={styles.list}>
        {visible.map((node) => (
          <li key={node.study.rowId}>
            <button type="button" className={styles.listRow} onClick={() => onFocus(node.study.rowId)}>
              <i className={cx(styles.swatch, styles.listSwatch)} style={swatch(node.colourIndex)} />
              <span className={styles.listBody}>
                <span className={styles.listLabel}>{node.study.label}</span>
                <span className={styles.listMeta}>
                  tier {node.tier}
                  {node.category && ' · ' + node.category}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {ranked.length > visible.length && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
          Show all {ranked.length}
        </Button>
      )}
      {ranked.length === 0 && <p className={styles.empty}>Nothing to show.</p>}
    </>
  );
}

interface StudyTableProps {
  model: OrbitModel;
  dataset: Dataset;
  filterKeys: string[];
  filters: FilterState;
  onFocus: (rowId: number) => void;
}

/**
 * The batch ranked by the course, one column per filter in "Your course", so
 * the values a study was kept for - and the ones it missed - can be read off
 * its row.
 *
 * Every study is listed, not only the ones that meet every setting. A setting
 * is a preference here rather than a condition, and the orbit only shows the
 * full matches and the near misses: the studies that miss more are kept here,
 * ranked below them, as the one place they can still be opened from. The full
 * matches are simply the top of the list, and the checkbox narrows to them.
 */
function StudyTable({ model, dataset, filterKeys, filters, onFocus }: StudyTableProps) {
  const [onlyFull, setOnlyFull] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const activeKeys = new Set(activeFilters(filters).map(([key]) => key));

  const fullMatchCount = model.nodes.filter((node) => node.fullMatch).length;
  const rows = model.nodes.filter((node) => !onlyFull || node.fullMatch).sort(byMatchThenTier);
  const visible = showAll ? rows : rows.slice(0, LIST_PREVIEW_SIZE);

  return (
    <>
      <header className={styles.panelHeader}>
        <h2 className={styles.title}>Ranked by your course</h2>
      </header>
      <div className={styles.tableControls}>
        <p className={styles.count}>
          {fullMatchCount} of {model.nodes.length} studies
          {model.activeFilterCount === 1
            ? ' · meeting your setting'
            : ' · meeting all ' + model.activeFilterCount + ' settings'}
        </p>
        <label className={styles.toggle}>
          <input type="checkbox" checked={onlyFull} onChange={(event) => setOnlyFull(event.target.checked)} />
          only those
        </label>
      </div>
      {rows.length > 0 && <DownloadStudies nodes={rows} dataset={dataset} filtered={onlyFull} />}
      {rows.length > 0 && (
        <div className={styles.scroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={cx(styles.head, styles.headStudy)}>
                  Study
                </th>
                <th
                  scope="col"
                  className={cx(styles.head, styles.headMatch)}
                  title="Settings of your course this study shares"
                >
                  Match
                </th>
                <th scope="col" className={cx(styles.head, styles.headTier)}>
                  Tier
                </th>
                {filterKeys.map((key) => (
                  <th key={key} scope="col" className={cx(styles.head, activeKeys.has(key) && styles.headActive)}>
                    {prettyKey(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((node) => (
                <tr key={node.study.rowId} className={styles.tableRow} onClick={() => onFocus(node.study.rowId)}>
                  <th scope="row" className={cx(styles.cell, styles.cellStudy)}>
                    <button type="button" className={styles.rowButton} title={node.study.label}>
                      <i className={styles.swatch} style={swatch(node.colourIndex)} />
                      <span className={styles.rowLabel}>{node.study.label}</span>
                    </button>
                  </th>
                  <td
                    className={cx(styles.cell, styles.cellMatch, node.fullMatch && styles.cellMatchFull)}
                    title={'matches ' + node.match + ' of ' + model.activeFilterCount + ' settings'}
                  >
                    {node.match}/{model.activeFilterCount}
                  </td>
                  <td className={cx(styles.cell, styles.cellTier)}>{node.tier}</td>
                  {filterKeys.map((key) => {
                    const text = cellText(node.study.data, key);
                    return (
                      <td key={key} className={cx(styles.cell, text === '' && styles.cellEmpty)} title={text}>
                        {text === '' ? '—' : text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > visible.length && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
          Show all {rows.length}
        </Button>
      )}
      {rows.length === 0 && (
        <p className={styles.empty}>
          {onlyFull
            ? 'No study meets every setting. Untick "only those" to see how close the batch comes, or drop a value in "Your course".'
            : 'Nothing to show.'}
        </p>
      )}
    </>
  );
}

interface StudyCardProps {
  node: OrbitNode;
  dataset: Dataset;
  mapping: ColumnMapping;
  activeFilterCount: number;
  onBack: () => void;
}

/** Everything the batch holds about one study, whether or not it meets the settings. */
function StudyCard({ node, dataset, mapping, activeFilterCount, onBack }: StudyCardProps) {
  // A column can only be filtered on when it holds a handful of short values,
  // which is exactly when it reads well as a label / value pair. The rest are
  // free text, and a paragraph set in the value column of a grid comes out as
  // a ribbon, so those get the panel's full width instead.
  const filterable = new Set(filterableColumns(dataset).map((column) => column.key));
  const columns = dataset.columns.filter((column) => column.key !== mapping.labelKey);
  const facts = columns.filter((column) => filterable.has(column.key));
  const notes = columns.filter((column) => !filterable.has(column.key));
  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← back to the {activeFilterCount > 0 ? 'table' : 'list'}
      </Button>
      <h3 className={styles.cardTitle}>
        <i className={cx(styles.swatch, styles.cardSwatch)} style={swatch(node.colourIndex)} />
        {node.study.label}
      </h3>
      <p className={styles.cardMeta}>
        tier {node.tier}
        {activeFilterCount > 0 && ' · matches ' + node.match + ' of ' + activeFilterCount + ' settings'}
      </p>
      <dl className={styles.facts}>
        {facts.map((column) => (
          <div key={column.key} className={styles.fact}>
            <dt>{prettyKey(column.key)}</dt>
            <dd>{cellText(node.study.data, column.key) || '—'}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && (
        <dl className={styles.notes}>
          {notes.map((column) => (
            <div key={column.key} className={styles.note}>
              <dt>{prettyKey(column.key)}</dt>
              <dd>{cellText(node.study.data, column.key) || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

function swatch(colourIndex: number): CSSProperties {
  return { '--swatch-colour': categoryColourVar(colourIndex) } as CSSProperties;
}
