import { useState } from 'react';
import type { Dataset } from '../../data/model';
import {
  downloadBlob,
  EXPORT_FORMATS,
  exportFileName,
  exportKeys,
  serialiseRows,
  studyRows,
  type ExportFormat,
} from '../../lib/export';
import type { OrbitNode } from '../../lib/layout';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Select } from '../ui/Select';
import styles from './DownloadStudies.module.css';

interface DownloadStudiesProps {
  /** The studies the panel is listing, in the order it lists them. */
  nodes: OrbitNode[];
  dataset: Dataset;
  /** True when the list is the studies that meet every setting, not the whole batch. */
  filtered: boolean;
}

/**
 * Download what the panel is listing.
 *
 * Exactly what is listed, in the order it is listed: narrowing by "Your
 * course" narrows the file the same way, so the button needs no settings of
 * its own beyond the format. What the user sees is what they get.
 */
export function DownloadStudies({ nodes, dataset, filtered }: DownloadStudiesProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  // Writing a workbook loads the spreadsheet library first, which on a slow
  // connection takes long enough to be worth saying.
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setWriting(true);
    try {
      const blob = await serialiseRows(studyRows(nodes, dataset), exportKeys(dataset), format);
      downloadBlob(blob, exportFileName(dataset.name, filtered ? 'matches' : 'studies', format));
      setError(null);
    } catch (cause) {
      setError('Could not write the file: ' + (cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setWriting(false);
    }
  };

  return (
    <>
      <div className={styles.row}>
        <span className={styles.format}>
          <Select
            value={format}
            onChange={(value) => setFormat(value as ExportFormat)}
            options={EXPORT_FORMATS.map((option) => ({ value: option.id, label: option.name }))}
            aria-label="Download format"
          />
        </span>
        <Button size="sm" disabled={nodes.length === 0 || writing} onClick={() => void download()}>
          {writing ? 'Writing…' : `Download ${nodes.length} ${nodes.length === 1 ? 'study' : 'studies'}`}
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
}
