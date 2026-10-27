import { useEffect, useRef, useState } from 'react';
import { MIN_WINDOW_WIDTH } from '../config/defaults';
import { useMinWidth } from '../hooks/useMinWidth';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import styles from './NarrowWindowDialog.module.css';

/**
 * Warns that the window is narrower than the layout is drawn for, and can be
 * dismissed - the app underneath still works, it is just cramped.
 *
 * The warning is mounted only while the window is narrow. That is what makes
 * a dismissal last exactly as long as it should: widening the window unmounts
 * the dialog and forgets it was dismissed, so narrowing the window again
 * warns again, without any of that being tracked in state.
 */
export function NarrowWindowDialog() {
  const wideEnough = useMinWidth(MIN_WINDOW_WIDTH);
  return wideEnough ? null : <Warning min={MIN_WINDOW_WIDTH} />;
}

function Warning({ min }: { min: number }) {
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Observed rather than listened for: a ResizeObserver reports the size once
  // as soon as it starts watching, so the reading is right even if the window
  // was measured mid-layout on the first render and never resized after.
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const observer = new ResizeObserver(() => setWidth(window.innerWidth));
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  if (dismissed) return null;

  return (
    /* Every way out of the dialog - the button, Escape - ends in `close`, so
       the state follows that one event rather than each of them. */
    <Dialog
      ref={dialogRef}
      title="This window is narrow"
      onClose={() => setDismissed(true)}
      actions={
        <Button variant="primary" onClick={() => dialogRef.current?.close()}>
          Continue anyway
        </Button>
      }
    >
      <p className={styles.body}>
        Lit Orbit is drawn for a window at least <strong>{min}px</strong> wide. Below that the panels stack under the
        orbit and there is little room left for it. Widen the window — or turn the device sideways — for the full
        layout.
      </p>
      <p className={styles.reading}>
        Window width now: <strong>{width}px</strong>
      </p>
    </Dialog>
  );
}
