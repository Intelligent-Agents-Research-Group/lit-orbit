import { RETIRED_STORAGE_KEYS, STORAGE_KEYS } from '../config/defaults';

export type StorageRole = keyof typeof STORAGE_KEYS;

/**
 * Kept by `clearStoredData`: how the app looks and which tool the user writes
 * code for - nothing about what they loaded into it.
 */
const KEPT_ROLES: readonly StorageRole[] = ['appearance', 'railWidth', 'detailWidth', 'codeTarget'];

/**
 * Put in front of every key this page stores, bar the light / dark choice.
 *
 * Empty in our own app. A published site sets one before it renders (see
 * `main.tsx`), because every site published to one GitHub account is served
 * from the same host - `<account>.github.io` - and a browser gives all the
 * pages of a host one storage. Without it, the course a visitor set on one
 * site would be read back on the next, against columns it does not have.
 */
let namespace = '';

export function setStorageNamespace(value: string): void {
  namespace = value;
}

/**
 * The key a role is stored under on this page. The light / dark choice is the
 * one thing shared by every page of the host: it is about the reader, not
 * about any batch.
 */
export function storageKey(role: StorageRole): string {
  return role === 'appearance' ? STORAGE_KEYS.appearance : namespace + STORAGE_KEYS[role];
}

/**
 * Forget everything the app has kept in this browser - the loaded batch, how
 * it is read, the filters and the tier rules - but keep the light / dark
 * choice, the panel widths and the code tab, which say nothing about the
 * user's data.
 */
export function clearStoredData(): void {
  try {
    for (const role of Object.keys(STORAGE_KEYS) as StorageRole[]) {
      if (KEPT_ROLES.includes(role)) continue;
      localStorage.removeItem(storageKey(role));
    }
    for (const key of RETIRED_STORAGE_KEYS) localStorage.removeItem(namespace + key);
  } catch {
    // Storage is blocked, so nothing was stored in the first place.
  }
}
