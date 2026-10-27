import { cx } from '../../lib/cx';
import styles from './Pills.module.css';

interface PillsProps {
  /** Every value that can be picked, in the order they should read. */
  values: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** Names the group for screen readers, e.g. the column it belongs to. */
  legend: string;
}

/**
 * Pick any number of values out of a short list. Checkboxes wearing pills
 * rather than a `<select multiple>`: the chosen values stay visible without
 * being opened, which is the point when several filters are set at once.
 */
export function Pills({ values, selected, onToggle, legend }: PillsProps) {
  return (
    <div className={styles.pills} role="group" aria-label={legend}>
      {values.map((value) => {
        const checked = selected.includes(value);
        return (
          <label key={value}>
            <input type="checkbox" className={styles.input} checked={checked} onChange={() => onToggle(value)} />
            <span className={cx(styles.pill, checked && styles.pillChecked)}>{value}</span>
          </label>
        );
      })}
    </div>
  );
}
