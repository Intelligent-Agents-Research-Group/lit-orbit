import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Like `useState`, but the value survives a page reload.
 *
 * The initial value is read from localStorage once (lazy initialiser) and each
 * change is written back by the setter, not by an effect: an effect would also
 * run on mount, re-serialising and re-writing a value that just came out of
 * storage unchanged - which for the batch means megabytes of JSON on every
 * page load - and it is a write that belongs to the event that caused it.
 *
 * `override`, when given, is the value this page was opened on - one carried by
 * its address - and beats whatever the browser stored: the link names the view
 * its sender saw, and what this browser remembers is a different question. It
 * is not written to storage; the first change made from it is.
 *
 * The third value says whether the last write was refused for want of room.
 * Storage failures used to be ignored wholesale, on the reasoning that the app
 * still works without them - which is true of a private window, where nothing
 * can be stored and nothing was expected to be. It is not true of a batch too
 * big for the quota: the small keys beside it still persist, so the next load
 * comes back half-restored, pointing a saved setup at a batch that is no
 * longer there. That the caller has to be told about.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T | (() => T),
  override?: T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(() => {
    if (override !== undefined) return override;
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // Ignore unreadable storage and fall back to the initial value.
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const [overflowed, setOverflowed] = useState(false);
  // The setter resolves a `prev => next` update itself, because the write has
  // to see the new value and a state updater is not the place for a side
  // effect - React may call one twice.
  const latest = useRef(value);

  const update = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const next = typeof action === 'function' ? (action as (prev: T) => T)(latest.current) : action;
      latest.current = next;
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setOverflowed(false);
      } catch (cause) {
        // Blocked storage and full storage are different answers: only the
        // second one is worth interrupting the user for.
        setOverflowed(isQuotaError(cause));
      }
    },
    [key],
  );

  return [value, update, overflowed];
}

/** Every engine names this differently; the deprecated codes are the old ones. */
function isQuotaError(cause: unknown): boolean {
  if (!(cause instanceof DOMException)) return false;
  return cause.name === 'QuotaExceededError' || cause.code === 22 || cause.code === 1014;
}
