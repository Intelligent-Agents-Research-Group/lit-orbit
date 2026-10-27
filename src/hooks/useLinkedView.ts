import { useEffect, useState } from 'react';
import type { FilterState } from '../lib/matching';
import { parseUrlState, replaceUrlState } from '../lib/urlState';

/**
 * The study open in the panel, with the address bar kept in step with the
 * view - the settings that count, and that study - so copying the address at
 * any moment gives a link to what is on screen (see `lib/urlState.ts`).
 *
 * `initialStudy` is the study the page was opened on, when its address names
 * one. `filters` are the settings as the page shows them, so a link never
 * names a setting the page is not showing; `setFilters` is how a link that
 * arrives under an open page puts its settings in place.
 */
export function useLinkedView(
  initialStudy: number | null,
  filters: FilterState,
  setFilters: (filters: FilterState) => void,
) {
  const [focusedRowId, setFocusedRowId] = useState<number | null>(initialStudy);

  // The address follows the view.
  useEffect(() => {
    replaceUrlState({ filters, study: focusedRowId });
  }, [filters, focusedRowId]);

  // And the view follows the address, when the address is changed under a page
  // that is already open: a link pasted into the same tab, or the back button
  // stepping between two of them. The page's own writes do not fire this.
  useEffect(() => {
    const onHashChange = () => {
      const link = parseUrlState(location.hash);
      setFilters(link.filters);
      setFocusedRowId(link.study);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [setFilters]);

  return [focusedRowId, setFocusedRowId] as const;
}
