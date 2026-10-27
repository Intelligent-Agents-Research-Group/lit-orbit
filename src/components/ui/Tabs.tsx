import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Tabs.module.css';

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: readonly Tab<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** Names the row of tabs for screen readers. */
  label: string;
  /** What the selected tab shows. */
  children: ReactNode;
}

/**
 * A row of tabs over one panel. The parent owns which tab is selected, as it
 * owns a `Select`'s value, so the choice can be kept wherever it likes. The
 * arrow keys move between tabs, as they do in every native tab strip.
 */
export function Tabs<T extends string>({ tabs, selected, onSelect, label, children }: TabsProps<T>) {
  const id = useId();
  const tabId = (tab: T) => `${id}-tab-${tab}`;
  const panelId = `${id}-panel`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === selected);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onSelect(next.id);
    document.getElementById(tabId(next.id))?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const current = tab.id === selected;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={current}
              aria-controls={panelId}
              // Only the selected tab is in the tab order; the arrows reach the rest.
              tabIndex={current ? 0 : -1}
              className={cx(styles.tab, current && styles.tabSelected)}
              onClick={() => onSelect(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected)}>
        {children}
      </div>
    </div>
  );
}
