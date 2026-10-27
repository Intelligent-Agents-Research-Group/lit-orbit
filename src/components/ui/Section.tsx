import type { ReactNode } from 'react';
import styles from './Section.module.css';

interface SectionProps {
  title: string;
  /** Optional control rendered on the right of the title (a button, a count...). */
  action?: ReactNode;
  description?: string;
  children: ReactNode;
}

export function Section({ title, action, description, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {action}
      </header>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </section>
  );
}
