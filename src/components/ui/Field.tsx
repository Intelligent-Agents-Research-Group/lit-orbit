import type { ReactNode } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  label: string;
  /** Small text on the right of the label, e.g. a count or a remove button. */
  aside?: ReactNode;
  hint?: string;
  children: ReactNode;
}

/** Label + control. `children` is the React equivalent of Vue's default <slot>. */
export function Field({ label, aside, hint, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        <span>{label}</span>
        {aside}
      </span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
