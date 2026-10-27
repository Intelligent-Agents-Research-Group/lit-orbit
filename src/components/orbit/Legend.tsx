import type { CSSProperties } from 'react';
import type { OrbitModel } from '../../lib/layout';
import { RING_FULL_MATCHES } from '../../config/defaults';
import { categoryColourVar } from '../../lib/theme';
import { cx } from '../../lib/cx';
import { prettyKey } from '../../lib/text';
import styles from './Orbit.module.css';

interface LegendProps {
  model: OrbitModel;
  colourLabel: string | null;
}

/** Colour and match encodings. Colours come from CSS tokens via categoryColourVar. */
export function Legend({ model, colourLabel }: LegendProps) {
  const firstColour = categoryColourVar(0);
  return (
    <div className={styles.legend} aria-label="Legend">
      {colourLabel && model.categories.length > 0 && (
        <>
          <p className={styles.legendTitle}>{prettyKey(colourLabel)}</p>
          {model.categories.map((category, index) => (
            <div key={category} className={styles.legendRow}>
              <i className={styles.swatch} style={swatch(categoryColourVar(index))} />
              <span className={styles.legendLabel}>{category}</span>
            </div>
          ))}
        </>
      )}
      {model.activeFilterCount > 0 && (
        <>
          <p className={styles.legendTitle}>Reading the dots</p>
          <div className={styles.legendRow}>
            <i className={cx(styles.swatch, RING_FULL_MATCHES && styles.swatchOutlined)} style={swatch(firstColour)} />
            <span className={styles.legendLabel}>Matches every filter</span>
          </div>
          {/* The rows follow matchLook: with a single filter there is no near
              miss, since missing one means sharing nothing. */}
          {model.activeFilterCount >= 2 && (
            <div className={styles.legendRow}>
              <i className={cx(styles.swatch, styles.swatchNearMiss)} style={swatch(firstColour)} />
              <span className={styles.legendLabel}>Misses one</span>
            </div>
          )}
          <div className={styles.legendRow}>
            <i className={styles.swatch} />
            <span className={styles.legendLabel}>
              {model.activeFilterCount >= 2 ? 'Misses more: not drawn' : 'No match: not drawn'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function swatch(colour: string): CSSProperties {
  // A CSS custom property set inline; the .swatch rule reads it as its background.
  return { '--swatch-colour': colour } as CSSProperties;
}
