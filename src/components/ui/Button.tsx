import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** React 19 passes `ref` like any other prop, so it just travels with `rest`. */
  ref?: Ref<HTMLButtonElement>;
};

/**
 * A plain button. Props not listed here (onClick, disabled, title, ...) are
 * forwarded to the underlying <button>, the React equivalent of Vue's
 * `v-bind="$attrs"`.
 */
export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        styles.button,
        variant !== 'secondary' && styles[variant],
        size !== 'md' && styles[size],
        className,
      )}
      {...rest}
    />
  );
}
