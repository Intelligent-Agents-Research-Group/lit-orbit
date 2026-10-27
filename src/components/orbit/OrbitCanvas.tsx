import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { RING_FULL_MATCHES } from '../../config/defaults';
import { cx } from '../../lib/cx';
import {
  ORBIT_GEOMETRY,
  nodePoint,
  orbitGeometry,
  ringRadius,
  wedgeBoundaryAngle,
  wedgeCentreAngle,
  wedgeLabelRoom,
  type OrbitModel,
  type OrbitNode,
  type Point,
} from '../../lib/layout';
import type { Appearance } from '../../lib/appearance';
import { layoutCentreLabel, type CentreLabelLayout } from '../../lib/centreLabel';
import { categoryColour, readOrbitTheme, type OrbitTheme } from '../../lib/theme';
import { TIERS } from '../../data/model';
import { Button } from '../ui/Button';
import { Legend } from './Legend';
import { Tooltip } from './Tooltip';
import styles from './Orbit.module.css';

interface OrbitCanvasProps {
  model: OrbitModel;
  /** Only used to re-read the colour tokens when the palette changes. */
  appearance: Appearance;
  /** Row id of the study opened in the detail panel. */
  focusedRowId: number | null;
  centreLabel: string;
  colourLabel: string | null;
  onFocus: (rowId: number | null) => void;
}

interface HoverState {
  node: OrbitNode;
  x: number;
  y: number;
  /** Stage width at hover time, so the tooltip can stay inside the stage. */
  stageWidth: number;
}

/** Radians per second. Measured in time, not frames, so the orbit turns at
 *  the same speed on a 60Hz and a 120Hz screen and a dropped frame does
 *  not show up as a stutter. */
const SPIN_SPEED = 0.036;
/** Longest step the spin will take in one frame, so coming back to a
 *  backgrounded tab resumes rather than jumping. */
const MAX_FRAME_MS = 100;
const DRAG_SPEED = 0.004;
const HIT_RADIUS = 12;
/** How many times the glow behind a hovered dot is painted, to deepen it. */
const GLOW_PASSES = 3;
const TAU = Math.PI * 2;
/** Where a wedge label waits for its first frame: off the stage, not in the corner. */
const LABEL_OFFSTAGE = { transform: 'translate(-200%, -200%)' };

/**
 * The orbit itself. React owns the surrounding HUD, legend and tooltip; the
 * dots are drawn imperatively on a <canvas> inside a requestAnimationFrame
 * loop. Everything the loop needs lives in refs so it can read the latest
 * values without restarting (the React "escape hatch" for animation).
 */
export function OrbitCanvas({ model, appearance, focusedRowId, centreLabel, colourLabel, onFocus }: OrbitCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wedgeLabelsRef = useRef<HTMLDivElement>(null);

  // Latest props for the animation loop.
  const modelRef = useRef(model);
  const focusedRef = useRef(focusedRowId);
  const centreLabelRef = useRef(centreLabel);
  const hoveredRef = useRef<number | null>(null);

  // Loop-internal state that must not trigger re-renders.
  const themeRef = useRef<OrbitTheme | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const dprRef = useRef(1);
  const spinRef = useRef(0);
  const autoSpinRef = useRef(false);
  const dragRef = useRef({ active: false, lastX: 0, moved: false });
  const pointsRef = useRef(new Map<number, Point>());
  const centreLayoutRef = useRef<CentreLayoutCache>({ key: '', layout: null });

  const [hover, setHover] = useState<HoverState | null>(null);
  const [dragging, setDragging] = useState(false);
  // Still until asked: a study is easier to read, and to point at, while it
  // stays put. Spinning only ever starts from its button, so it needs no
  // reduced-motion check.
  const [autoSpin, setAutoSpin] = useState(false);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  useEffect(() => {
    focusedRef.current = focusedRowId;
  }, [focusedRowId]);
  useEffect(() => {
    centreLabelRef.current = centreLabel;
  }, [centreLabel]);
  useEffect(() => {
    autoSpinRef.current = autoSpin;
  }, [autoSpin]);

  // Mount once: size the canvas, read the theme, run the frame loop.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    themeRef.current = readOrbitTheme();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = stage.getBoundingClientRect();
      sizeRef.current = { width, height };
      dprRef.current = dpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    let frame = 0;
    let lastFrameAt = performance.now();
    const loop = (now: number) => {
      const elapsed = Math.min(now - lastFrameAt, MAX_FRAME_MS);
      lastFrameAt = now;
      if (autoSpinRef.current && !dragRef.current.active) spinRef.current += (SPIN_SPEED * elapsed) / 1000;
      const theme = themeRef.current;
      if (theme) {
        drawFrame(context, sizeRef.current, theme, modelRef.current, {
          spin: spinRef.current,
          hovered: hoveredRef.current,
          focused: focusedRef.current,
          centreLabel: centreLabelRef.current,
          centreLayout: centreLayoutRef.current,
          points: pointsRef.current,
          dpr: dprRef.current,
        });
      }
      positionWedgeLabels(wedgeLabelsRef.current, sizeRef.current, spinRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // A canvas cannot use `var(--x)`, so the tokens are copied into a plain
  // object. Switching palettes changes those tokens, so read them again; the
  // next frame then paints in the new colours.
  useEffect(() => {
    themeRef.current = readOrbitTheme();
  }, [appearance]);

  const localPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const hitTest = (point: Point): OrbitNode | null => {
    let best: OrbitNode | null = null;
    let bestDistance = Infinity;
    for (const node of modelRef.current.nodes) {
      const position = pointsRef.current.get(node.study.rowId);
      if (!position) continue;
      const distance = Math.hypot(position.x - point.x, position.y - point.y);
      if (distance <= HIT_RADIUS + node.size && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, lastX: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.active) {
      const dx = event.clientX - drag.lastX;
      if (Math.abs(dx) > 1) drag.moved = true;
      if (drag.moved) {
        spinRef.current += dx * DRAG_SPEED;
        drag.lastX = event.clientX;
        if (!dragging) setDragging(true);
        if (hover) setHover(null);
        hoveredRef.current = null;
        setAutoSpin(false);
      }
      return;
    }
    const point = localPoint(event);
    const node = hitTest(point);
    hoveredRef.current = node ? node.study.rowId : null;
    setHover(node ? { node, x: point.x, y: point.y, stageWidth: sizeRef.current.width } : null);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const wasClick = drag.active && !drag.moved;
    dragRef.current = { active: false, lastX: 0, moved: false };
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (wasClick) {
      const node = hitTest(localPoint(event));
      onFocus(node ? node.study.rowId : null);
    }
  };

  const handlePointerLeave = () => {
    hoveredRef.current = null;
    setHover(null);
  };

  const shownCount = model.nodes.filter((node) => !node.hidden).length;

  return (
    <div ref={stageRef} className={styles.stage}>
      <canvas
        ref={canvasRef}
        className={cx(styles.canvas, dragging && styles.dragging)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        role="img"
        aria-label="Orbit of studies around your course"
      />
      <div ref={wedgeLabelsRef} className={styles.wedgeLabels}>
        {model.wedgeLabels.map((label) => (
          <span key={label} className={styles.wedgeLabel} style={LABEL_OFFSTAGE}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.hud}>
        <span>
          Matching on <strong>{model.activeFilterCount}</strong> setting{model.activeFilterCount === 1 ? '' : 's'}
          {model.activeFilterCount > 0 && (
            <>
              {' · '}
              <strong>{shownCount}</strong> of {model.nodes.length} shown
            </>
          )}
          {' · drag to spin'}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setAutoSpin((spinning) => !spinning)}>
          {autoSpin ? 'Stop spin' : 'Start spin'}
        </Button>
      </div>
      <Legend model={model} colourLabel={colourLabel} />
      {hover && (
        <Tooltip
          node={hover.node}
          x={hover.x}
          y={hover.y}
          stageWidth={hover.stageWidth}
          activeFilterCount={model.activeFilterCount}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Pure drawing. No React here: given a context, a size, a theme and a model, */
/* paint one frame and record where every dot landed for hit-testing.        */
/* ------------------------------------------------------------------------- */

interface FrameState {
  spin: number;
  hovered: number | null;
  focused: number | null;
  centreLabel: string;
  centreLayout: CentreLayoutCache;
  points: Map<number, Point>;
  /** Canvas blurs a shadow in device pixels rather than user space. */
  dpr: number;
}

/** The centre label as last laid out, and what it was laid out for. */
interface CentreLayoutCache {
  key: string;
  layout: CentreLabelLayout | null;
}

/**
 * The course name laid out for the centre. Measuring every way of breaking it
 * is cheap but not free, so the last layout is kept until the name, the fonts
 * or the size of the orbit change. A web font that finishes loading changes
 * the widths, so it counts as a change too.
 */
function centreLabelLayout(
  context: CanvasRenderingContext2D,
  theme: OrbitTheme,
  state: FrameState,
  rMax: number,
): CentreLabelLayout {
  const fontSize = Number.parseFloat(theme.textSm);
  const font = '600 ' + fontSize + 'px ' + theme.fontSans;
  const key = [state.centreLabel, font, theme.textXs, rMax, document.fonts.status].join('|');
  const cache = state.centreLayout;
  if (cache.layout && cache.key === key) return cache.layout;
  context.font = font;
  cache.key = key;
  cache.layout = layoutCentreLabel(state.centreLabel, (text) => context.measureText(text).width, {
    radius: ORBIT_GEOMETRY.centreRadius * rMax,
    maxRadius: ORBIT_GEOMETRY.centreMaxRadius * rMax,
    fontSize,
    minFontSize: Number.parseFloat(theme.textXs),
  });
  return cache.layout;
}

function drawFrame(
  context: CanvasRenderingContext2D,
  size: { width: number; height: number },
  theme: OrbitTheme,
  model: OrbitModel,
  state: FrameState,
) {
  const { width, height } = size;
  const { centre, rMax } = orbitGeometry(width, height);
  const wedgeCount = model.wedgeLabels.length;
  const labelFont = theme.textXs + ' ' + theme.fontSans;

  context.clearRect(0, 0, width, height);
  context.fillStyle = theme.bg;
  context.fillRect(0, 0, width, height);

  // Rings, outermost first so the labels of inner rings paint on top.
  //
  // A ring is named after what it holds rather than numbered, so the room a
  // label gets is the orbit's own width. Names are only drawn when the
  // longest of them fits in it: five names cut short and stacked read as a
  // paragraph across the top of the chart rather than as five labels, so a
  // small orbit goes back to numbering its rings.
  context.font = labelFont;
  const ringLabelRoom = Math.max(ORBIT_GEOMETRY.minLabelWidth, rMax * 2 - 16);
  const namedRings = TIERS.every((tier) => context.measureText(model.tierLabels[tier]).width <= ringLabelRoom);
  context.lineWidth = 1;
  for (const tier of [...TIERS].reverse()) {
    const r = ringRadius(tier) * rMax;
    context.beginPath();
    context.arc(centre.x, centre.y, r, 0, TAU);
    context.strokeStyle = tier === 1 ? theme.ringLineStrong : theme.ringLine;
    context.setLineDash(tier === 1 ? [] : [3, 4]);
    context.stroke();
    context.setLineDash([]);
    context.font = labelFont;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    const ringLabel = namedRings ? model.tierLabels[tier] : 'tier ' + tier;
    // A ring no rule uses is left unnamed: no study can sit on it.
    if (ringLabel === '') continue;
    const labelY = centre.y - r + ORBIT_GEOMETRY.ringLabelOffset;
    // A name is long enough that its own ring line runs through it, so the
    // line is cleared out from behind the words: a dashed rule through a
    // sentence is harder to read past than the gap it leaves.
    const metrics = context.measureText(ringLabel);
    context.fillStyle = theme.bg;
    context.fillRect(
      centre.x - metrics.width / 2 - 4,
      labelY - metrics.actualBoundingBoxAscent - 2,
      metrics.width + 8,
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + 4,
    );
    context.fillStyle = theme.ringLabel;
    context.fillText(ringLabel, centre.x, labelY);
  }

  // Wedge boundaries and labels.
  const centreLabel = centreLabelLayout(context, theme, state, rMax);
  if (wedgeCount > 1) {
    const inner = centreLabel.radius;
    const outer = (ringRadius(5) + 0.05) * rMax;
    context.strokeStyle = theme.wedgeLine;
    for (let i = 0; i < wedgeCount; i += 1) {
      const angle = wedgeBoundaryAngle(i, wedgeCount, state.spin);
      context.beginPath();
      context.moveTo(centre.x + Math.cos(angle) * inner, centre.y + Math.sin(angle) * inner);
      context.lineTo(centre.x + Math.cos(angle) * outer, centre.y + Math.sin(angle) * outer);
      context.stroke();
    }
  }

  // Centre: the user's course, broken into lines and grown to hold them.
  context.beginPath();
  context.arc(centre.x, centre.y, centreLabel.radius, 0, TAU);
  context.fillStyle = theme.centreFill;
  context.fill();
  context.fillStyle = theme.centreText;
  context.font = '600 ' + centreLabel.fontSize + 'px ' + theme.fontSans;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const line of centreLabel.lines) context.fillText(line.text, centre.x, centre.y + line.y, line.maxWidth);

  // Dots, near misses first so a full match always paints over one, with the
  // hovered and the focused one held back to paint on top. A study that misses
  // more than one setting is left off, and so cannot be hovered or clicked
  // either - unless it is the one open in the panel: the table still lists
  // it, and a row clicked there has to land somewhere.
  state.points.clear();
  const ordered = [...model.nodes].sort((a, b) => Number(b.nearMiss) - Number(a.nearMiss));
  let onTop: { node: OrbitNode; point: Point }[] = [];
  for (const node of ordered) {
    const rowId = node.study.rowId;
    if (node.hidden && rowId !== state.focused) continue;
    const point = nodePoint(node, wedgeCount, state.spin, centre, rMax);
    state.points.set(rowId, point);
    if (rowId === state.hovered || rowId === state.focused) {
      onTop.push({ node, point });
      continue;
    }
    drawDot(context, theme, node, point, false, false, state.dpr);
  }
  onTop = onTop.sort(
    (a, b) => Number(a.node.study.rowId === state.focused) - Number(b.node.study.rowId === state.focused),
  );
  for (const { node, point } of onTop) {
    drawDot(context, theme, node, point, true, node.study.rowId === state.focused, state.dpr);
  }
  context.globalAlpha = 1;
}

/**
 * Wedge labels are elements, not canvas text. Canvas has to rasterise a glyph
 * wherever it lands, and these labels travel about four pixels a second, so
 * every frame painted the same words a fraction of a pixel from where they
 * were - which reads as a shimmer. Rounding the position to whole pixels only
 * trades that for a step every fifth of a second, which reads as a stutter
 * whatever the screen refreshes at. An element is rasterised once and moved by
 * the compositor, which is sub-pixel and smooth at any speed.
 */
function positionWedgeLabels(layer: HTMLDivElement | null, size: { width: number; height: number }, spin: number) {
  if (!layer) return;
  const { centre, rMax } = orbitGeometry(size.width, size.height);
  const labels = layer.children;
  const radius = ORBIT_GEOMETRY.wedgeLabelRadius * rMax;
  const room = wedgeLabelRoom(size.width, rMax) + 'px';
  for (let i = 0; i < labels.length; i += 1) {
    const element = labels[i] as HTMLElement;
    const angle = wedgeCentreAngle(i, labels.length, spin);
    const cos = Math.cos(angle);
    // Which point of the label the orbit holds: its left edge out on the right
    // of the orbit, its middle at the top, its right edge on the left. Given as
    // a share of the label's own width, so the browser does the measuring - and
    // it slides, where switching between left, centre and right alignment used
    // to jump a label sideways by its own width as it passed the threshold.
    const anchor = (1 - cos) / 2;
    const x = centre.x + cos * radius;
    const y = centre.y + Math.sin(angle) * radius;
    element.style.maxWidth = room;
    element.style.transform = `translate(${x}px, ${y}px) translate(${-anchor * 100}%, -50%)`;
  }
}

function drawDot(
  context: CanvasRenderingContext2D,
  theme: OrbitTheme,
  node: OrbitNode,
  point: Point,
  emphasised: boolean,
  focused: boolean,
  dpr: number,
) {
  const radius = emphasised ? node.size * ORBIT_GEOMETRY.dotHoverScale : node.size;
  const fill = categoryColour(theme, node.colourIndex);
  if (focused) {
    context.globalAlpha = 1;
    context.beginPath();
    context.arc(point.x, point.y, radius + 5, 0, TAU);
    context.fillStyle = theme.dotHalo;
    context.fill();
  }

  // Hover and focus glow in the dot's own colour, painted under the dot
  // itself. Canvas blurs a shadow in device pixels rather than user space, so
  // the radius is scaled by the DPR to keep one glow on every screen. The
  // shadow is painted several times because one blurred edge barely reads
  // against the paper.
  if (emphasised) {
    context.globalAlpha = theme.dotGlowAlpha;
    context.shadowColor = fill;
    context.shadowBlur = theme.dotGlowBlur * dpr;
    context.fillStyle = fill;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, TAU);
    for (let pass = 0; pass < GLOW_PASSES; pass += 1) context.fill();
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
  }

  // A dot being read is drawn solid whatever it matches, as it glows
  // whatever it matches: the one under the pointer is never the faint one.
  context.globalAlpha = node.nearMiss && !emphasised ? theme.dotNearMissAlpha : 1;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, TAU);
  context.fillStyle = fill;
  context.fill();

  // A full match is ringed rather than glowing, so it stays readable in a
  // crowd: the glow is kept for the dot under the pointer.
  if (node.fullMatch && RING_FULL_MATCHES) {
    context.lineWidth = 1.6;
    context.strokeStyle = theme.dotOutline;
    context.stroke();
  }
  context.globalAlpha = 1;
}
