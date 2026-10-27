import { useCallback, useLayoutEffect, useState } from 'react';
import { applyAppearance, initialAppearance, storeAppearance, type Appearance } from '../lib/appearance';

/**
 * Light / dark switching. Returns the current palette and a toggle, much like
 * `useState` with only one possible change.
 *
 * The attribute is written in a *layout* effect so the new tokens are in the
 * DOM before the canvas re-reads them with getComputedStyle (a plain effect
 * would run after, and the first frame would still be painted in the old
 * colours). Only an explicit toggle is stored: until then the OS setting wins,
 * so a user who switches their system to dark at night gets a dark app.
 */
export function useAppearance(): [Appearance, () => void] {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);

  useLayoutEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  const toggle = useCallback(() => {
    setAppearance((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      storeAppearance(next);
      return next;
    });
  }, []);

  return [appearance, toggle];
}
