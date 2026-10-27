import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { PANEL_RESIZE_STEP } from '../../config/defaults';
import { cx } from '../../lib/cx';
import styles from './Resizer.module.css';

interface ResizerProps {
  /** The panel this handle resizes; its box turns a pointer position into a width. */
  panelRef: RefObject<HTMLElement | null>;
  /** Which edge of the panel the handle sits on. */
  edge: 'end' | 'start';
  /** Names the panel in the handle's accessible label ("Resize the study list"). */
  label: string;
  min: number;
  max: number;
  onResize: (width: number) => void;
  /** Called on a double-click: back to the width the panel starts at. */
  onReset: () => void;
  /** Positioning is the parent's business, so it passes a class. */
  className?: string;
}

/**
 * A draggable edge between a side panel and the orbit.
 *
 * The width is read off the panel itself rather than tracked from where the
 * drag started: the handle sits on one edge, so the distance from the pointer
 * to the *other* edge is the width, and a drag that runs past a limit does not
 * build up an offset to unwind before the panel moves again.
 */
export function Resizer({ panelRef, edge, label, min, max, onResize, onReset, className }: ResizerProps) {
  const [dragging, setDragging] = useState(false);

  const widthAt = (clientX: number): number | null => {
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return null;
    const width = edge === 'end' ? clientX - box.left : box.right - clientX;
    return Math.min(max, Math.max(min, Math.round(width)));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Capturing the pointer keeps the moves coming to this element even when
    // the cursor runs over the canvas or out of the window.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const width = widthAt(event.clientX);
    if (width !== null) onResize(width);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const towards = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (towards === 0) return;
    event.preventDefault();
    const current = panelRef.current?.getBoundingClientRect().width;
    if (current === undefined) return;
    // An arrow key widens the panel when it moves the edge away from it.
    const step = towards * PANEL_RESIZE_STEP * (edge === 'end' ? 1 : -1);
    onResize(Math.min(max, Math.max(min, Math.round(current + step))));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={'Resize ' + label}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      className={cx(styles.resizer, dragging && styles.dragging, className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    >
      <i className={styles.grip} aria-hidden="true" />
    </div>
  );
}
