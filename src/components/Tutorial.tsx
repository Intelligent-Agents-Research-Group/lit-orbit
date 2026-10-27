import { RING_FULL_MATCHES } from '../config/defaults';
import { cx } from '../lib/cx';
import styles from './Tutorial.module.css';

/**
 * The tour on the landing page: what Lit Orbit draws, and how a file becomes
 * that picture.
 *
 * It sits in front of both ways in. Someone viewing the example needs it to
 * read the orbit at all, and someone building their own needs it more: every
 * choice on the three setup pages presumes the orbit - a ring is an evidence
 * tier, a wedge is a column, a dot is inked by a filter - and nobody can
 * say which column should cut the wedges before knowing what a wedge is.
 */
export function Tutorial() {
  return (
    <div>
      <div className={styles.reading}>
        <OrbitDiagram />
        <ol className={styles.points}>
          <li className={styles.point}>
            <span className={styles.badge}>1</span>
            <span>
              <strong>The centre is your course.</strong> You describe it in <em>Your course</em> — level, class size,
              language, whichever settings your batch happens to record. Picking two values in one filter means either
              will do.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.badge}>2</span>
            <span>
              <strong>Rings are evidence tiers.</strong> The innermost ring is tier 1, the designs that rule the most
              out — studies that compared groups at random. The outermost holds everything that could not be ranked.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.badge}>3</span>
            <span>
              <strong>Wedges cut the circle by one column.</strong> Whatever that column says about a study decides
              which slice it lands in. Two more columns set each dot's colour and its size.
            </span>
          </li>
          <li className={styles.point}>
            <span className={styles.badge}>4</span>
            <span>
              <strong>Bolder means a better fit.</strong> A study that shares every setting of your course is drawn
              solid, one that misses a single setting is drawn half-transparent, and the rest are left off the orbit.
              The list beside it ranks the whole batch by the same count.
            </span>
          </li>
        </ol>
      </div>

      <h3 className={styles.stepsTitle}>How a file becomes that picture</h3>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.stepNumber}>1</span>
          <strong className={styles.stepTitle}>Read the file</strong>
          <span className={styles.stepBody}>
            CSV, TSV, XLSX or JSON, opened inside your browser. Nothing is uploaded and no account is needed.
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.stepNumber}>2</span>
          <strong className={styles.stepTitle}>Read the cells</strong>
          <span className={styles.stepBody}>
            Every column gets a rule: split a cell holding several answers, keep only the <em>Yes</em> of “Yes — and
            here is how”, group numbers into bands.
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.stepNumber}>3</span>
          <strong className={styles.stepTitle}>Give columns roles</strong>
          <span className={styles.stepBody}>
            Which column is the title, which one cuts the wedges, which one decides the tier. Nothing has to be renamed
            in the file first.
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.stepNumber}>4</span>
          <strong className={styles.stepTitle}>Draw the orbit</strong>
          <span className={styles.stepBody}>
            The rings, the filters and the ranked list all follow from what steps 2 and 3 settled.
          </span>
        </li>
      </ol>

      <p className={styles.close}>
        <strong>Build your own walks through steps 1 to 3 on three pages</strong> — the file first, then its cells with
        the table beside them, then the roles and the rings with the orbit drawn beside them as you go. Every choice was
        guessed from your file to begin with, and every one stays editable in the panel beside the orbit afterwards.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The diagram: the orbit with the numbers of the list written onto it, so each
   rule is read next to the thing it governs rather than in the abstract.
   Geometry only - every colour comes from the stylesheet, which is also what
   lets it follow the light / dark switch.
   -------------------------------------------------------------------------- */

const CENTRE = 130;
/** Ring radii, innermost first: three tiers are enough to show the idea. */
const RINGS = [52, 78, 104];
const WEDGE_COUNT = 5;
const DIVIDER_INNER = 30;
const DIVIDER_OUTER = 110;
/** Where the numbered badges sit: just outside the outermost ring. */
const BADGE_RING = 116;

/**
 * `angle` is degrees clockwise from the top; `tone` picks the class that paints
 * the dot, and `nearMiss` draws it as a study that misses one setting.
 */
const DOTS: { angle: number; radius: number; tone: string; nearMiss?: boolean }[] = [
  { angle: 28, radius: 52, tone: 'cat1' },
  { angle: 46, radius: 78, tone: 'cat2' },
  { angle: 20, radius: 104, tone: 'cat5', nearMiss: true },
  { angle: 100, radius: 52, tone: 'cat2', nearMiss: true },
  { angle: 118, radius: 78, tone: 'cat3' },
  { angle: 96, radius: 104, tone: 'cat1' },
  { angle: 164, radius: 52, tone: 'cat4' },
  { angle: 196, radius: 104, tone: 'cat2', nearMiss: true },
  { angle: 244, radius: 52, tone: 'cat5' },
  { angle: 262, radius: 78, tone: 'cat4', nearMiss: true },
  { angle: 270, radius: 104, tone: 'cat1', nearMiss: true },
  { angle: 316, radius: 52, tone: 'cat3' },
  { angle: 332, radius: 78, tone: 'cat1' },
  { angle: 300, radius: 104, tone: 'cat4' },
];

function polar(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: CENTRE + radius * Math.cos(radians), y: CENTRE + radius * Math.sin(radians) };
}

function OrbitDiagram() {
  const fullMatch = polar(78, 180);

  return (
    <svg
      className={styles.diagram}
      viewBox="0 0 260 260"
      role="img"
      aria-label="The orbit, numbered to match the list beside it: the course at the centre, rings for tiers, wedges for a column, and a full match beside a near miss."
    >
      {/* Tier 1 is drawn stronger than the rest, as the canvas draws it. */}
      {RINGS.map((radius, index) => (
        <circle
          key={radius}
          className={cx(styles.ring, index === 0 && styles.ringInner)}
          cx={CENTRE}
          cy={CENTRE}
          r={radius}
        />
      ))}

      {Array.from({ length: WEDGE_COUNT }, (_, index) => {
        const angle = (index * 360) / WEDGE_COUNT;
        const from = polar(DIVIDER_INNER, angle);
        const to = polar(DIVIDER_OUTER, angle);
        return <line key={angle} className={styles.divider} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}

      <circle className={styles.centre} cx={CENTRE} cy={CENTRE} r={26} />

      {DOTS.map((dot) => {
        const point = polar(dot.radius, dot.angle);
        return (
          <circle
            key={`${dot.angle}-${dot.radius}`}
            className={cx(styles.dot, styles[dot.tone], dot.nearMiss && styles.nearMiss)}
            cx={point.x}
            cy={point.y}
            r={5}
          />
        );
      })}

      {/* The study that satisfies every filter, marked as the orbit marks a
          full match, next to a near miss - so the tour teaches the real marks. */}
      <circle
        className={cx(styles.dot, styles.cat1, RING_FULL_MATCHES && styles.outlined)}
        cx={fullMatch.x}
        cy={fullMatch.y}
        r={5.5}
      />

      <Badge n={1} x={CENTRE} y={CENTRE} onCentre />
      <Badge n={2} {...polar(BADGE_RING, 90)} />
      <Badge n={3} {...polar(BADGE_RING, 0)} />
      <Badge n={4} {...polar(BADGE_RING, 180)} />
    </svg>
  );
}

/** A number from the list, written onto the diagram. On the centre it needs no disc of its own. */
function Badge({ n, x, y, onCentre = false }: { n: number; x: number; y: number; onCentre?: boolean }) {
  return (
    <g>
      {!onCentre && <circle className={styles.badgeMark} cx={x} cy={y} r={10} />}
      <text className={onCentre ? styles.badgeTextOnCentre : styles.badgeText} x={x} y={y}>
        {n}
      </text>
    </g>
  );
}
