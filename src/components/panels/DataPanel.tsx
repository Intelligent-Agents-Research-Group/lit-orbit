import { IMPORT_FILE_TYPES } from '../../config/defaults';
import type { Dataset } from '../../data/model';
import type { BatchLoader } from '../../hooks/useBatchLoader';
import type { ColumnSetup } from '../../hooks/useStoredSetup';
import { batchKeepingNotice, hasFileReadingChoices } from '../../lib/importInfo';
import { Button } from '../ui/Button';
import { FileButton } from '../ui/FileButton';
import { Notice } from '../ui/Notice';
import { Section } from '../ui/Section';
import { ColumnRoles, ColumnRulesFields, FileReading } from './ColumnSettings';
import styles from './DataPanel.module.css';

interface DataPanelProps {
  dataset: Dataset;
  columns: ColumnSetup;
  loader: BatchLoader;
}

/** The batch beside the orbit: what it is, how it was read, and the controls the setup pages had. */
export function DataPanel({ dataset, columns, loader }: DataPanelProps) {
  const { importInfo, error } = loader;
  const keepingNotice = batchKeepingNotice(loader.batchKeeping);

  // The start screen decides this: our batch comes set up, so no batch loader
  // is offered beside it - a file of your own starts from *Build your own*.
  const ownBatch = dataset.source === 'file';

  return (
    <Section
      title="Batch"
      action={
        ownBatch ? (
          <FileButton accept={IMPORT_FILE_TYPES} onFile={loader.loadBatch} size="sm">
            Load another file
          </FileButton>
        ) : undefined
      }
    >
      <p className={styles.datasetName} title={dataset.name}>
        {dataset.name}
      </p>
      <p className={styles.meta}>
        {dataset.rows.length} studies · {dataset.columns.length} columns
        {ownBatch && (
          <>
            {' · '}
            <Button variant="ghost" size="sm" onClick={loader.chooseBaseBatch}>
              use the example
            </Button>
          </>
        )}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {keepingNotice && <Notice tone="warning">{keepingNotice}</Notice>}
      {importInfo && importInfo.keptRows < importInfo.totalRows && (
        <Notice tone="warning">
          Showing the first {importInfo.keptRows} of {importInfo.totalRows} rows.
        </Notice>
      )}

      {hasFileReadingChoices(importInfo) && (
        <details className={styles.details}>
          <summary className={styles.summary}>How the file was read</summary>
          <FileReading importInfo={importInfo} onReimport={loader.reimport} />
        </details>
      )}

      <details className={styles.details}>
        <summary className={styles.summary}>Column roles</summary>
        <ColumnRoles dataset={dataset} mapping={columns.mapping} onMappingChange={columns.setMapping} />
      </details>

      {ownBatch && (
        <details className={styles.details}>
          <summary className={styles.summary}>Column rules</summary>
          <ColumnRulesFields
            rules={columns.rules}
            ruleChoices={columns.choices}
            onColumnRuleChange={columns.changeRule}
          />
        </details>
      )}
    </Section>
  );
}
