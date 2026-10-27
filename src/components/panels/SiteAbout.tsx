import type { Dataset } from '../../data/model';
import type { SiteInfo } from '../../lib/site';
import { Section } from '../ui/Section';
import styles from './SiteAbout.module.css';

interface SiteAboutProps {
  site: SiteInfo;
  dataset: Dataset;
}

/**
 * What a published site says about its map, in the place our app keeps the
 * batch controls. A reader of the site has nothing to load and nothing to set
 * up, so the panel says what they are looking at and where it comes from.
 */
export function SiteAbout({ site, dataset }: SiteAboutProps) {
  const { citation, url } = site.paper;
  return (
    <Section title="About this map">
      {site.description && <p className={styles.description}>{site.description}</p>}
      {(citation || url) && (
        <div className={styles.paper}>
          {citation && <p className={styles.citation}>{citation}</p>}
          {url && (
            <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer">
              Read the paper
            </a>
          )}
        </div>
      )}
      <p className={styles.meta}>
        {dataset.rows.length} studies · {dataset.columns.length} columns
      </p>
      <p className={styles.credit}>
        Made with{' '}
        {site.madeWith ? (
          <a className={styles.link} href={site.madeWith} target="_blank" rel="noopener noreferrer">
            Lit Orbit
          </a>
        ) : (
          'Lit Orbit'
        )}
      </p>
    </Section>
  );
}
