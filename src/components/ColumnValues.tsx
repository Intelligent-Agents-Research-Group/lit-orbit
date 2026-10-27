import { useMemo } from 'react';
import { PREVIEW_VALUES } from '../config/defaults';
import { cellValues, findColumn, type Dataset } from '../data/model';
import { compareValues, prettyKey } from '../lib/text';
import styles from './ColumnValues.module.css';

interface ColumnValuesProps {
  dataset: Dataset;
  columnKey: string;
}

/**
 * Every value one column yields under its rule, most common first, with how
 * many cells hold each. Eight rows of a table show what a rule does to a
 * cell; this shows what it does to the column - whether "split on a comma"
 * left six tools or sixty fragments - which is the question a rule is chosen
 * on.
 */
export function ColumnValues({ dataset, columnKey }: ColumnValuesProps) {
  const column = findColumn(dataset, columnKey);
  const counts = useMemo(() => {
    const byValue = new Map<string, number>();
    for (const row of dataset.rows) {
      for (const value of cellValues(row, columnKey)) byValue.set(value, (byValue.get(value) ?? 0) + 1);
    }
    return [...byValue.entries()].sort(([a, countA], [b, countB]) => countB - countA || compareValues(a, b));
  }, [dataset, columnKey]);
  const listed = counts.slice(0, PREVIEW_VALUES);
  const rest = counts.length - listed.length;

  const summary =
    column === undefined
      ? 'Empty under this rule: no cell holds anything.'
      : [
          `${counts.length} distinct ${counts.length === 1 ? 'value' : 'values'}`,
          `${column.filled} of ${dataset.rows.length} cells filled`,
          column.multi ? 'some cells hold several' : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <div className={styles.values}>
      <h3 className={styles.title}>{prettyKey(columnKey)} reads as</h3>
      <p className={styles.summary}>{summary}</p>
      {listed.length > 0 && (
        <ul className={styles.list}>
          {listed.map(([value, count]) => (
            <li key={value} className={styles.pill} title={value}>
              <span className={styles.value}>{value}</span>
              <span className={styles.count}>{count}</span>
            </li>
          ))}
          {rest > 0 && <li className={styles.more}>and {rest} more</li>}
        </ul>
      )}
    </div>
  );
}
