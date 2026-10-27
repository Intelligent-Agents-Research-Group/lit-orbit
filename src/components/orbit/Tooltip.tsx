import type { OrbitNode } from '../../lib/layout';
import styles from './Orbit.module.css';

interface TooltipProps {
  node: OrbitNode;
  x: number;
  y: number;
  stageWidth: number;
  activeFilterCount: number;
}

const TOOLTIP_WIDTH = 250;
const OFFSET = 14;

export function Tooltip({ node, x, y, stageWidth, activeFilterCount }: TooltipProps) {
  const left = Math.max(0, Math.min(x + OFFSET, stageWidth - TOOLTIP_WIDTH));
  return (
    <div className={styles.tooltip} style={{ left, top: y + OFFSET }} role="status">
      <strong>{node.study.label}</strong>
      {node.category && <div>{node.category}</div>}
      <div className={styles.tooltipMuted}>
        tier {node.tier}
        {activeFilterCount > 0 && (
          <>
            {' · '}matches {node.match} of {activeFilterCount}
          </>
        )}
      </div>
    </div>
  );
}
