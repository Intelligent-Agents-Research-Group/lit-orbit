import type { Appearance } from '../lib/appearance';
import type { SiteInfo } from '../lib/site';
import { Button } from './ui/Button';
import { ThemeToggle } from './ui/ThemeToggle';
import styles from './Header.module.css';

interface HeaderProps {
  /**
   * What is on screen: in our app, the example we ship or a batch of the
   * user's own; or a site published from it, which is one batch and nothing
   * else.
   */
  mode: 'example' | 'own' | 'site';
  /** What a published site says about itself; set in `site` mode. */
  site: SiteInfo | null;
  appearance: Appearance;
  onToggleAppearance: () => void;
  onChangeSource: () => void;
  /** Reopens the first setup page; only offered for a batch of the user's own. */
  onOpenSetup: () => void;
  /** Opens the publish dialog; only offered for a batch of the user's own. */
  onPublish: () => void;
}

const TAGLINE = 'Your course sits at the centre; the bolder a study is drawn, the better it matches.';

export function Header({
  mode,
  site,
  appearance,
  onToggleAppearance,
  onChangeSource,
  onOpenSetup,
  onPublish,
}: HeaderProps) {
  if (mode === 'site' && site) {
    // A published site is its author's map: its title, a way to the paper,
    // and none of the controls that would lead a reader away from the batch.
    const title = site.title || 'Lit Orbit';
    return (
      <header className={styles.header}>
        <h1 className={styles.siteTitle} title={title}>
          {title}
        </h1>
        <span className={styles.subtitle}>{TAGLINE}</span>
        <div className={styles.actions}>
          {site.paper.url && (
            <a className={styles.link} href={site.paper.url} target="_blank" rel="noopener noreferrer">
              Read the paper
            </a>
          )}
          <ThemeToggle appearance={appearance} onToggle={onToggleAppearance} />
        </div>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Lit Orbit</h1>
      <span className={styles.subtitle}>{TAGLINE}</span>
      <div className={styles.actions}>
        {/* The example is already set up, so only a batch of the user's own has
            setup pages to go back to - and only a batch of their own is theirs
            to publish. */}
        {mode === 'example' ? (
          <span className={styles.flag}>Example batch</span>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onOpenSetup}>
              Edit setup
            </Button>
            <Button size="sm" onClick={onPublish}>
              Publish as a website
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onChangeSource}>
          Change data source
        </Button>
        <ThemeToggle appearance={appearance} onToggle={onToggleAppearance} />
      </div>
    </header>
  );
}
