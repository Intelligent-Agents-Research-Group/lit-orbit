import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Notice.module.css';

interface NoticeProps {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
}

export function Notice({ tone = 'info', children }: NoticeProps) {
  return <p className={cx(styles.notice, tone !== 'info' && styles[tone])}>{children}</p>;
}
