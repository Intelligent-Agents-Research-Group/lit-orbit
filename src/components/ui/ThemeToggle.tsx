import type { Appearance } from '../../lib/appearance';
import { Button } from './Button';

interface ThemeToggleProps {
  appearance: Appearance;
  onToggle: () => void;
  /** Hide the word next to the icon, for tight spots like the header. */
  iconOnly?: boolean;
}

/** Switches between the light and dark palettes defined in tokens.css. */
export function ThemeToggle({ appearance, onToggle, iconOnly = false }: ThemeToggleProps) {
  const goingDark = appearance === 'light';
  const label = goingDark ? 'Switch to dark colours' : 'Switch to light colours';
  return (
    <Button variant="ghost" size="sm" onClick={onToggle} title={label} aria-label={label}>
      {goingDark ? <MoonIcon /> : <SunIcon />}
      {!iconOnly && <span>{goingDark ? 'Dark' : 'Light'}</span>}
    </Button>
  );
}

/* The icons show what a click leads to, not the palette in use. */

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      <path d="M13.4 9.6A5.6 5.6 0 0 1 6.4 2.6a5.6 5.6 0 1 0 7 7Z" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3.1" />
      <path
        d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
