import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Input.module.css';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** React 19 passes `ref` like any other prop, so it just travels with `rest`. */
  ref?: Ref<HTMLInputElement>;
};

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
};

/**
 * A plain text box, drawn like `Select` so the two line up in one form. Every
 * prop goes through to the <input> - type, value, onChange, placeholder - as
 * `Button` forwards its own. A `className` is added to the base look rather
 * than replacing it, for a box that needs another width or size.
 */
export function Input({ className, ...rest }: InputProps) {
  return <input className={cx(styles.input, className)} {...rest} />;
}

/** The same box, several lines tall. */
export function TextArea({ className, ...rest }: TextAreaProps) {
  return <textarea className={cx(styles.input, className)} {...rest} />;
}
