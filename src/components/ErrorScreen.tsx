import type { ReactNode } from 'react';
import { Notice } from './ui/Notice';
import styles from './ErrorScreen.module.css';

interface ErrorScreenProps {
  title: string;
  /** What went wrong, in the words of whatever threw. */
  message: string;
  /** What the reader can do about it, in ours. */
  hint: ReactNode;
  /** A way out, when there is one to offer. */
  action?: ReactNode;
}

/**
 * The card shown instead of the app when there is no app to show: the batch
 * could not be read at startup, or a component threw while rendering. Both
 * are dead ends for the whole screen, so both get the same centred card
 * rather than a panel inside a layout that is not going to appear.
 */
export function ErrorScreen({ title, message, hint, action }: ErrorScreenProps) {
  return (
    <div className={styles.screen}>
      <main className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <Notice tone="error">{message}</Notice>
        <p className={styles.hint}>{hint}</p>
        {action && <div className={styles.actions}>{action}</div>}
      </main>
    </div>
  );
}
