import { useState, type ReactNode } from 'react';
import { DEFAULT_COURSE_NAME_LINES, MAX_ROWS } from '../config/defaults';
import type { Appearance } from '../lib/appearance';
import { cx } from '../lib/cx';
import { Button } from './ui/Button';
import { Notice } from './ui/Notice';
import { ThemeToggle } from './ui/ThemeToggle';
import { Tutorial } from './Tutorial';
import styles from './Landing.module.css';

interface LandingProps {
  appearance: Appearance;
  /** How many studies the example batch holds. */
  baseSize: number;
  error: string | null;
  /** Only set once a batch is already open, so the page can be left again. */
  onDismiss?: () => void;
  onToggleAppearance: () => void;
  onViewExample: () => void;
  onBuildOwn: () => void;
  onClearStoredData: () => void;
}

/**
 * The landing page: what Lit Orbit is, how to read it, and the two ways in.
 * It is the whole screen rather than a dialog, because the choice decides what
 * the rest of the app shows - the example goes straight to the orbit, and
 * building your own goes through the three setup pages first.
 */
export function Landing(props: LandingProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  const actions = (
    <div className={styles.actions}>
      <Button size="lg" variant="primary" onClick={props.onBuildOwn}>
        Build your own
      </Button>
      <Button size="lg" onClick={props.onViewExample}>
        View an example
      </Button>
    </div>
  );

  return (
    <div className={styles.screen}>
      <header className={styles.topbar}>
        <span className={styles.brand}>
          <BrandMark />
          Lit Orbit
        </span>
        <nav className={styles.nav}>
          <a className={styles.navLink} href="#when-to-use">
            When to use it
          </a>
          <a className={styles.navLink} href="#how-it-works">
            How it works
          </a>
          {props.onDismiss && (
            <Button size="sm" variant="ghost" onClick={props.onDismiss}>
              Back to what I had open
            </Button>
          )}
          <ThemeToggle appearance={props.appearance} onToggle={props.onToggleAppearance} />
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Literature review, at a glance</p>
            <h1 className={styles.headline}>
              Every study in your batch, <span className={styles.accent}>orbiting your course.</span>
            </h1>
            <p className={styles.lede}>
              Lit Orbit turns a spreadsheet of studies into one picture. Your course sits at the centre and each study
              is a dot: the nearer the middle, the stronger its evidence, and the bolder the dot, the more of your
              course it shares — so the studies worth reading first are the bold ones near the middle.
            </p>
            {actions}
            <p className={styles.meta}>
              The example holds {props.baseSize} studies on generative AI in computing education. Your own batch can be
              CSV, TSV, XLSX or JSON, up to {MAX_ROWS} rows - and once it is set up, it can be published as a website of
              its own, to link to from your paper.
            </p>
            {props.error && <Notice tone="error">{props.error}</Notice>}
          </div>
          <HeroOrbit />
        </section>

        <section className={styles.features}>
          <Feature title="Rings rank the evidence">
            Tier 1 — studies that compared groups at random — sits innermost; what could not be ranked sits outermost.
          </Feature>
          <Feature title="Any spreadsheet will do">
            Column names are read from the file, so nothing has to be renamed first. You say which column plays which
            role.
          </Feature>
          <Feature title="A ranked list beside it">
            Every study is also listed next to the orbit, ranked by how much of your course it shares, and the list
            downloads as CSV, XLSX or JSON.
          </Feature>
        </section>

        <section className={styles.fit} id="when-to-use">
          <p className={styles.sectionEyebrow}>Is it for you?</p>
          <h2 className={styles.sectionTitle}>When to reach for Lit Orbit</h2>
          <p className={styles.sectionLede}>
            It answers one question well: of these studies, which were run somewhere like my course, and how strong is
            their evidence? Here is where that question comes up, and where another picture serves better.
          </p>
          <div className={styles.fitGrid}>
            <FitCard title="Reach for it when">
              <FitPoint lead="Your studies are already coded.">
                One row per study and one column per question, the way a review's extraction sheet ends up. The orbit is
                drawn from those columns; it does not read the papers.
              </FitPoint>
              <FitPoint lead="Readers bring a setting of their own.">
                A course level, a language, a class size. The filters let each reader ask which studies were run
                somewhere like theirs, and see the answer as the bold dots.
              </FitPoint>
              <FitPoint lead="Study designs can be ranked.">
                The rings mean something only when, for your question, a randomised trial counts for more than a survey.
                The tier rules are yours to edit, but the rank has to exist.
              </FitPoint>
              <FitPoint lead="The review will be published, and its data with it.">
                A batch set up here becomes a website to link to from the paper, so readers explore the evidence instead
                of scanning a table in the appendix.
              </FitPoint>
            </FitCard>
            <FitCard title="Reach for something else when">
              <FitPoint lead="The question is where the gaps are.">
                Which interventions have been tried against which outcomes is a grid question. An evidence gap map
                answers it at a glance; rings and wedges do not.
              </FitPoint>
              <FitPoint lead="The answer is a number.">
                Lit Orbit sizes and colours dots. It pools no effects and computes nothing from them; a meta-analysis
                wants a forest plot.
              </FitPoint>
              <FitPoint lead="The batch is mostly prose.">
                A column of long written answers cannot be a filter, a wedge or a tier. The orbit needs categories, and
                the file check on the first setup page says where a file falls short of them.
              </FitPoint>
              <FitPoint lead="It has to be a figure on paper.">
                The orbit is interactive, and is published as a website rather than drawn as an image. A paper points at
                it with a link, which can name one view of it.
              </FitPoint>
            </FitCard>
          </div>
        </section>

        <section className={styles.tutorial} id="how-it-works">
          <p className={styles.sectionEyebrow}>Tutorial</p>
          <h2 className={styles.sectionTitle}>How to read an orbit</h2>
          <p className={styles.sectionLede}>
            Four things to know before the first one is drawn, and the four steps a file goes through to become one.
          </p>
          <div className={styles.tutorialCard}>
            <Tutorial />
          </div>
        </section>

        <section className={styles.cta}>
          <div>
            <h2 className={styles.ctaTitle}>Ready to look?</h2>
            <p className={styles.ctaBody}>
              Start from the example to get a feel for it, or bring your own batch and set it up in three short pages —
              you can step back to either page at any time.
            </p>
          </div>
          {actions}
        </section>

        <footer className={styles.footer}>
          <p className={styles.privacy}>
            <LockIcon />
            <span>
              <strong>Nothing you load leaves this device.</strong> Files are read inside your browser: Lit Orbit has no
              server to send them to, keeps no copy and needs no account. So a reload does not lose your work, your
              batch and settings are kept in this browser's own storage — and only there.
            </span>
          </p>
          <div className={styles.footerActions}>
            {confirmingClear ? (
              <span className={styles.confirm}>
                <span>Forget the stored batch, its setup and the filters?</span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setConfirmingClear(false);
                    props.onClearStoredData();
                  }}
                >
                  Clear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingClear(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmingClear(true)}>
                Clear stored data
              </Button>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: string }) {
  return (
    <div className={styles.feature}>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureBody}>{children}</p>
    </div>
  );
}

/** One of the two columns of "When to reach for Lit Orbit": a title over a list of points. */
function FitCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.fitCard}>
      <h3 className={styles.fitTitle}>{title}</h3>
      <ul className={styles.fitList}>{children}</ul>
    </div>
  );
}

function FitPoint({ lead, children }: { lead: string; children: string }) {
  return (
    <li className={styles.fitPoint}>
      <strong>{lead}</strong> {children}
    </li>
  );
}

/* --------------------------------------------------------------------------
   The hero illustration: a slowly turning orbit. Decoration only - the
   numbered diagram in the tutorial is the one that explains. Each ring turns
   at its own speed, which is what makes it read as an orbit rather than a
   rotating picture; the stylesheet stops it for people who ask for less
   motion. Geometry here, every colour in the stylesheet.
   -------------------------------------------------------------------------- */

const HERO_CENTRE = 200;
const HERO_RINGS = [74, 118, 162];
const HERO_WEDGES = 6;
const HERO_TONES = ['cat1', 'cat2', 'cat3', 'cat4', 'cat6', 'cat7'];

interface HeroDot {
  x: number;
  y: number;
  r: number;
  tone: string;
  nearMiss: boolean;
}

/**
 * A fixed scatter rather than a random one, so the picture is the same on
 * every visit: each ring gets a few dots per wedge, coloured by wedge, with
 * roughly one in three drawn half-transparent, as the orbit draws a near miss.
 */
function heroDots(ringIndex: number): HeroDot[] {
  const radius = HERO_RINGS[ringIndex];
  const perWedge = ringIndex + 2;
  const dots: HeroDot[] = [];
  for (let wedge = 0; wedge < HERO_WEDGES; wedge += 1) {
    for (let k = 0; k < perWedge; k += 1) {
      const seed = wedge * 7 + k * 3 + ringIndex * 11;
      const within = ((k + 0.5) / perWedge) * 0.8 + 0.1;
      const angle = ((wedge + within) / HERO_WEDGES) * Math.PI * 2 - Math.PI / 2;
      const jitter = ((seed * 37) % 17) - 8;
      dots.push({
        x: HERO_CENTRE + (radius + jitter) * Math.cos(angle),
        y: HERO_CENTRE + (radius + jitter) * Math.sin(angle),
        r: 4 + ((seed * 13) % 4),
        tone: HERO_TONES[wedge],
        nearMiss: seed % 3 === 0,
      });
    }
  }
  return dots;
}

const HERO_DOTS = HERO_RINGS.map((_, index) => heroDots(index));
const RING_CLASSES = ['spinInner', 'spinMiddle', 'spinOuter'];

function HeroOrbit() {
  return (
    <svg className={styles.heroOrbit} viewBox="0 0 400 400" aria-hidden="true">
      <circle className={styles.halo} cx={HERO_CENTRE} cy={HERO_CENTRE} r={196} />
      {HERO_RINGS.map((radius, index) => (
        <circle
          key={radius}
          className={cx(styles.ring, index === 0 && styles.ringInner)}
          cx={HERO_CENTRE}
          cy={HERO_CENTRE}
          r={radius}
        />
      ))}
      {HERO_DOTS.map((dots, index) => (
        <g key={index} className={cx(styles.spin, styles[RING_CLASSES[index]])}>
          {dots.map((dot, dotIndex) => (
            <circle
              key={dotIndex}
              className={cx(styles.dot, styles[dot.tone], dot.nearMiss && styles.nearMiss)}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
            />
          ))}
        </g>
      ))}
      <circle className={styles.centre} cx={HERO_CENTRE} cy={HERO_CENTRE} r={46} />
      {/* The first line is lifted by half the block's height, so the lines sit centred on the circle. */}
      <text className={styles.centreText} x={HERO_CENTRE} y={HERO_CENTRE}>
        {DEFAULT_COURSE_NAME_LINES.map((line, index) => (
          <tspan
            key={line}
            x={HERO_CENTRE}
            dy={index === 0 ? `${-0.6 * (DEFAULT_COURSE_NAME_LINES.length - 1)}em` : '1.2em'}
          >
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className={styles.brandMark} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
      <circle cx="16.2" cy="5" r="1.8" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className={styles.privacyIcon}
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" strokeLinecap="round" />
    </svg>
  );
}
