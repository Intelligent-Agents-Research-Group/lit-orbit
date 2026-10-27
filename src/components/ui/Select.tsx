import { cx } from '../../lib/cx';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown as the empty option (value ''). Omit to make a choice mandatory. */
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

/**
 * A controlled <select>. "Controlled" means React state is the only source of
 * truth: the parent passes `value` and gets every change through `onChange`
 * (like `v-model`, but explicit).
 *
 * The box and its arrow are drawn here rather than by the operating system,
 * so the same form looks the same on a Mac and on Windows; only the list
 * that opens is still the system's.
 */
export function Select({ value, onChange, options, placeholder, disabled, id, ...aria }: SelectProps) {
  return (
    <span className={cx(styles.wrap, disabled && styles.wrapDisabled)}>
      <select
        id={id}
        className={cx(styles.select, value === '' && styles.placeholder)}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label={aria['aria-label']}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}
