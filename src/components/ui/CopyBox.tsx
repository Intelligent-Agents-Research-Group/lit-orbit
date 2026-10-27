import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { TextArea } from './Input';
import styles from './CopyBox.module.css';

/** How long the button reads "Copied" before it offers to copy again. */
const COPIED_FOR_MS = 2000;

interface CopyBoxProps {
  value: string;
  /** Names the box for screen readers. */
  label: string;
  rows?: number;
}

/**
 * Text written for the user to take somewhere else, with a button that puts
 * it on the clipboard. It stays a text box rather than a block of text so it
 * can be read, scrolled and selected by hand when the clipboard is refused -
 * which a browser does on a page it does not trust, or outside a click.
 */
export function CopyBox({ value, label, rows = 12 }: CopyBoxProps) {
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    let done = false;
    try {
      await navigator.clipboard.writeText(value);
      done = true;
    } catch {
      // No clipboard here: select the text, so that one keystroke copies it,
      // and try the old way, which some browsers still answer.
      box.current?.focus();
      box.current?.select();
      done = document.execCommand('copy');
    }
    if (!done) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
  };

  return (
    <div className={styles.box}>
      <TextArea
        ref={box}
        className={styles.text}
        value={value}
        readOnly
        rows={rows}
        aria-label={label}
        // Selecting the whole text on focus is what a box meant to be copied from is for.
        onFocus={(event) => event.target.select()}
      />
      <div className={styles.actions}>
        <Button size="sm" variant="primary" aria-live="polite" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
