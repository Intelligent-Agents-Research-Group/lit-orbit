import { STORAGE_KEYS } from '../config/defaults';

/** Which of the two palettes in src/styles/tokens.css is in use. */
export type Appearance = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isAppearance(value: string | null): value is Appearance {
  return value === 'light' || value === 'dark';
}

/**
 * The palette to start from: the last explicit choice, otherwise whatever the
 * operating system asks for. Stored as a plain string (not JSON) so it can be
 * read before React mounts - see src/main.tsx.
 */
export function initialAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.appearance);
    if (isAppearance(stored)) return stored;
  } catch {
    // Storage blocked (private window): fall through to the OS setting.
  }
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

/** Select the palette by setting `data-theme` on <html>. */
export function applyAppearance(appearance: Appearance): void {
  document.documentElement.dataset.theme = appearance;
}

/** Remember an explicit choice, so a reload keeps it instead of asking the OS. */
export function storeAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEYS.appearance, appearance);
  } catch {
    // The choice still applies for this session.
  }
}
