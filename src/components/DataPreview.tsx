import { useEffect, useRef } from 'react';
import { PREVIEW_ROWS } from '../config/defaults';
import { cellText, cellValues, type Dataset } from '../data/model';
import { cx } from '../lib/cx';
import styles from './DataPreview.module.css';

interface DataPreviewProps {
  dataset: Dataset;
  /** The column whose rule is in hand: lit, and scrolled into view when it changes. */
  highlightKey?: string | null;
}

/**
 * The first rows of the batch as they are currently read. A column rule is
 * hard to choose in the abstract - "cut at a dash" means nothing until you
 * see what is left of the cell - so the table sits beside the rules and moves
 * with them. Cells holding several values are marked, because that is the one
 * thing a comma in the text would otherwise hide.
 */
export function DataPreview({ dataset, highlightKey = null }: DataPreviewProps) {
  const rows = dataset.rows.slice(0, PREVIEW_ROWS);
  const lit = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    // A wide table keeps most columns off screen, so the one in hand is
    // brought in. jsdom has no scrollIntoView; every browser does.
    lit.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [highlightKey]);
  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            {dataset.columns.map((column) => {
              const highlighted = column.key === highlightKey;
              return (
                <th
                  key={column.key}
                  ref={highlighted ? lit : undefined}
                  scope="col"
                  className={cx(styles.head, highlighted && styles.highlight)}
                >
                  {column.key}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {dataset.columns.map((column) => {
                const values = cellValues(row, column.key);
                const text = cellText(row, column.key);
                return (
                  <td
                    key={column.key}
                    className={cx(
                      styles.cell,
                      values.length > 1 && styles.many,
                      values.length === 0 && styles.empty,
                      column.key === highlightKey && styles.highlight,
                    )}
                    title={text}
                  >
                    {text === '' ? '—' : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
