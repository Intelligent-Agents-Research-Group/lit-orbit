import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ColumnMapping, Dataset } from '../../data/model';
import type { CourseSettings } from '../../hooks/useStoredSetup';
import { filterColumnCandidates } from '../../lib/dataset';
import { Button } from '../ui/Button';
import { Pills } from '../ui/Pills';
import { Section } from '../ui/Section';
import { prettyKey } from '../../lib/text';
import styles from './FilterPanel.module.css';

interface FilterPanelProps {
  dataset: Dataset;
  /** The roles, so a column the orbit is drawn by is not offered as a setting. */
  mapping: ColumnMapping;
  course: CourseSettings;
}

/**
 * "Your course": the settings of the course the user is planning for. A study
 * is drawn solid when it shares them all, half-transparent when it misses
 * one, and not at all when it misses more.
 * Each setting takes several values, because a course is not always one
 * thing - two course levels, two languages - and a study that matches either
 * of them matches the course.
 */
export function FilterPanel(props: FilterPanelProps) {
  const { dataset, mapping, course } = props;
  const { keys: filterKeys, filters } = course;
  const activeCount = filterKeys.filter((key) => (filters[key]?.length ?? 0) > 0).length;
  const available = filterColumnCandidates(dataset, mapping).filter((column) => !filterKeys.includes(column.key));

  return (
    <Section
      title="Your course"
      action={
        activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={course.clear}>
            Clear all
          </Button>
        ) : undefined
      }
      description="Studies that share all your settings are drawn solid, those missing one half-transparent, and the rest are hidden. Pick as many values as your course has."
    >
      {filterKeys.map((key) => {
        const column = dataset.columns.find((c) => c.key === key);
        if (!column) return null;
        const selected = filters[key] ?? [];
        return (
          // Not a <Field>: that is a <label>, and a label may not wrap the
          // checkboxes of a whole group.
          <div key={key} className={styles.filter}>
            <p className={styles.filterHeader}>
              <span>{prettyKey(key)}</span>
              <span className={styles.chosen}>{selected.length > 0 ? selected.length + ' chosen' : 'any'}</span>
              {selected.length > 0 && (
                <button
                  type="button"
                  className={styles.clear}
                  onClick={() => course.clearKey(key)}
                  title={'Unpick every value of ' + prettyKey(key)}
                  aria-label={'Clear the chosen values of ' + prettyKey(key)}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className={styles.remove}
                onClick={() => course.removeKey(key)}
                title={'Remove ' + prettyKey(key) + ' from your course'}
                aria-label={'Remove the filter ' + prettyKey(key)}
              >
                <TrashIcon />
              </button>
            </p>
            <Pills
              values={column.values}
              selected={selected}
              onToggle={(value) => course.toggleValue(key, value)}
              legend={prettyKey(key)}
            />
          </div>
        );
      })}
      {filterKeys.length === 0 && <p className={styles.empty}>No filters yet.</p>}
      {available.length > 0 && <AddFilterMenu columns={available} onPick={course.addKey} />}
    </Section>
  );
}

/** Removing a whole setting is a discard, so the control says so. */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      <path d="M2.6 4.3h10.8" strokeLinecap="round" />
      <path d="M6.2 4.3V3.1c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9v1.2" strokeLinejoin="round" />
      <path d="M4.1 4.3l.5 8.4c0 .5.5.9 1 .9h4.8c.5 0 1-.4 1-.9l.5-8.4" strokeLinejoin="round" />
      <path d="M6.7 6.9v4.3M9.3 6.9v4.3" strokeLinecap="round" />
    </svg>
  );
}

interface AddFilterMenuProps {
  columns: { key: string; values: string[] }[];
  onPick: (key: string) => void;
}

/** A button that drops down the columns not filtered on yet. */
function AddFilterMenu({ columns, onPick }: AddFilterMenuProps) {
  const [open, setOpen] = useState(false);
  // A ref is a box React keeps between renders; `.current` here is the DOM
  // node, like Vue's template ref but without the auto-unwrapping.
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or on a click anywhere else. The function an effect
  // returns is its cleanup, run before the next effect and on unmount.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Opening with the keyboard should land on the first column.
  useEffect(() => {
    if (open) menuRef.current?.querySelector('button')?.focus();
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll('button') ?? []);
    const here = items.indexOf(document.activeElement as HTMLButtonElement);
    const down = event.key === 'ArrowDown';
    const next = here === -1 ? (down ? 0 : items.length - 1) : (here + (down ? 1 : items.length - 1)) % items.length;
    items[next]?.focus();
  };

  const pick = (key: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    onPick(key);
  };

  return (
    <div className={styles.add} ref={wrapRef}>
      <Button
        ref={buttonRef}
        className={styles.addButton}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={styles.addIcon} aria-hidden="true">
          +
        </span>
        Add a filter
      </Button>
      {open && (
        <div className={styles.menu} role="menu" ref={menuRef} onKeyDown={onMenuKeyDown}>
          {columns.map((column) => (
            <button
              key={column.key}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => pick(column.key)}
            >
              <span className={styles.menuLabel}>{prettyKey(column.key)}</span>
              <span className={styles.menuCount}>{column.values.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
