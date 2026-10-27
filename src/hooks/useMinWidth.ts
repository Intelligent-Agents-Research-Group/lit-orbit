import { useEffect, useState } from 'react';

/**
 * True while the window is at least `min` CSS pixels wide.
 *
 * A media query rather than a resize listener: the browser does the
 * measuring and the component re-renders only when the answer flips, so
 * dragging the window edge does not re-render the orbit on every frame.
 */
export function useMinWidth(min: number): boolean {
  const query = '(min-width: ' + min + 'px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return wide;
}
