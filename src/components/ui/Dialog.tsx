import { useEffect, useId, type ReactNode, type RefObject, type SyntheticEvent } from 'react';
import { cx } from '../../lib/cx';
import styles from './Dialog.module.css';

interface DialogProps {
  /**
   * The <dialog> itself, made by the parent with `useRef`, so the parent can
   * close it from a button of its own: closing is what fires `onClose`.
   */
  ref: RefObject<HTMLDialogElement | null>;
  title: string;
  /** Room for a form rather than a notice. */
  wide?: boolean;
  children: ReactNode;
  /** The buttons, laid out on the right under the content. */
  actions: ReactNode;
  /**
   * The dialog was closed, by whichever way out. The browser fires this when
   * it gets round to it, and a page it is not drawing at the moment was seen
   * never to get it - see `PublishDialog` for a parent that does not wait.
   */
  onClose: () => void;
  /** Escape was pressed. `preventDefault` keeps the dialog open; otherwise it closes and `onClose` follows. */
  onCancel?: (event: SyntheticEvent<HTMLDialogElement>) => void;
}

/**
 * A modal: the browser's own <dialog>, opened with `showModal` as soon as it
 * mounts, which puts it in the top layer, dims the page, holds the focus and
 * closes it on Escape without any of that being written here. Mount it only
 * while it should be open - `{open && <Dialog …>}` - and it opens.
 */
export function Dialog({ ref, title, wide = false, children, actions, onClose, onCancel }: DialogProps) {
  const titleId = useId();

  // The guard is for React's development mode, which runs an effect twice:
  // `showModal` throws when the dialog is already open.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [ref]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, wide && styles.wide)}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onCancel}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {children}
      <div className={styles.actions}>{actions}</div>
    </dialog>
  );
}
