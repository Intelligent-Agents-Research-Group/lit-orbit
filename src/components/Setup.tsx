import { useMemo, useState, type ReactNode } from 'react';
import {
  COURSE_NAME_MAX_LENGTH,
  DEFAULT_COURSE_NAME,
  IMPORT_FILE_TYPES,
  MAX_ROWS,
  PREVIEW_ROWS,
} from '../config/defaults';
import { FILE_SHAPE } from '../config/fileShape';
import { SITE_CONFIG_FILE } from '../config/publish';
import type { BatchLoader } from '../hooks/useBatchLoader';
import type { StoredSetup } from '../hooks/useStoredSetup';
import type { Appearance } from '../lib/appearance';
import { cx } from '../lib/cx';
import { checkBatch, type FileWarning } from '../lib/fileCheck';
import { batchKeepingNotice, hasFileReadingChoices } from '../lib/importInfo';
import { CODE_TARGETS, reshapeInstruction, type CodeTarget } from '../lib/reshapeInstruction';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { FileButton } from './ui/FileButton';
import { Input } from './ui/Input';
import { Notice } from './ui/Notice';
import { Section } from './ui/Section';
import { ThemeToggle } from './ui/ThemeToggle';
import { ColumnValues } from './ColumnValues';
import { DataPreview } from './DataPreview';
import { FileCheck } from './FileCheck';
import { OrbitCanvas } from './orbit/OrbitCanvas';
import { ColumnRoles, ColumnRulesFields, FileReading } from './panels/ColumnSettings';
import { TierPanel } from './panels/TierPanel';
import styles from './Setup.module.css';

/**
 * The three pages of "Build your own": the file and how it was read, how each
 * of its columns is read, then the orbit drawn from them.
 */
export type SetupStep = 'data' | 'columns' | 'settings';

/** The pages in order, as the step indicator and the Back / Next buttons name them. */
const STEPS: { step: SetupStep; label: string }[] = [
  { step: 'data', label: 'Your file' },
  { step: 'columns', label: 'Your columns' },
  { step: 'settings', label: 'Your orbit' },
];

interface SetupProps {
  step: SetupStep;
  setup: StoredSetup;
  loader: BatchLoader;
  appearance: Appearance;
  onToggleAppearance: () => void;
  onStepChange: (step: SetupStep) => void;
  /** Leaves the first page for the landing page. */
  onExit: () => void;
  onDone: () => void;
}

/**
 * "Build your own": three pages between the landing page and the orbit.
 *
 * Everything asked here is a decision about what the file *means* - which
 * line the column names are on, what a cell holds, which column is the label,
 * how the tiers are decided - and every one of them is a guess until someone
 * who has seen the file says otherwise. The first page settles how the file
 * is read and says what the reader made of its shape; the second settles how
 * each column's cells are read, next to the first rows of the data; the third
 * settles what the orbit does with it, next to the orbit itself. Every choice
 * on the later pages is named by column, and the column names come out of the
 * first, which is why the order is fixed - but any page can be gone back to
 * at any time.
 *
 * The same controls stay in the rail beside the orbit afterwards, so nothing
 * here is a one-way door.
 */
export function Setup({
  step,
  setup,
  loader,
  appearance,
  onToggleAppearance,
  onStepChange,
  onExit,
  onDone,
}: SetupProps) {
  const ownBatch = setup.dataset.source === 'file';
  const index = STEPS.findIndex((candidate) => candidate.step === step);
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];
  // The first page keeps a reading width; the other two carry a preview
  // beside their settings, so they use the whole window.
  const wide = step !== 'data';
  // Looked at on the first page, and again on the second beside each rule.
  const warnings = useMemo(
    () => checkBatch(setup.batch, setup.dataset, loader.importInfo),
    [setup.batch, setup.dataset, loader.importInfo],
  );

  return (
    <div className={styles.screen}>
      <header className={styles.topbar}>
        <span className={styles.brand}>Lit Orbit</span>
        <ol className={styles.stepper} aria-label="Setup steps">
          {STEPS.map((candidate, n) => (
            <StepLink
              key={candidate.step}
              n={n + 1}
              current={candidate.step === step}
              // The later pages are named by the columns of the user's own
              // file, so until there is one they have nothing to show.
              disabled={n > 0 && !ownBatch}
              gap={n > 0}
              onClick={() => onStepChange(candidate.step)}
            >
              {candidate.label}
            </StepLink>
          ))}
        </ol>
        <div className={styles.topActions}>
          <ThemeToggle appearance={appearance} onToggle={onToggleAppearance} />
        </div>
      </header>

      {/* Keyed by step, so each page opens at its top rather than at wherever
          the last one was scrolled to. */}
      <main key={step} className={cx(styles.body, wide && styles.bodyWide)}>
        {step === 'data' && <DataStep setup={setup} loader={loader} warnings={warnings} />}
        {step === 'columns' && <ColumnsStep setup={setup} warnings={warnings} />}
        {step === 'settings' && <OrbitStep setup={setup} appearance={appearance} />}
      </main>

      <footer className={styles.bottombar}>
        <div className={cx(styles.bottomInner, wide && styles.bodyWide)}>
          {previous ? (
            <Button onClick={() => onStepChange(previous.step)}>← {previous.label}</Button>
          ) : (
            <Button onClick={onExit}>← Back to start</Button>
          )}
          <span className={styles.bottomNote}>{bottomNote(step, ownBatch)}</span>
          {next ? (
            <Button variant="primary" disabled={!ownBatch} onClick={() => onStepChange(next.step)}>
              Next: {next.label.toLowerCase()} →
            </Button>
          ) : (
            <Button variant="primary" onClick={onDone}>
              Show the orbit
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** What the next page asks, said beside the button that opens it. */
function bottomNote(step: SetupStep, ownBatch: boolean): string {
  switch (step) {
    case 'data':
      return ownBatch ? 'Next: how each column is read, with the table beside it.' : 'Choose a file to go on.';
    case 'columns':
      return 'Next: which column plays which role, and how the rings are decided.';
    case 'settings':
      return 'All of this stays in the panel beside the orbit, so it can be changed later.';
  }
}

interface StepLinkProps {
  n: number;
  current: boolean;
  disabled?: boolean;
  /** Drawn with a line before it, joining it to the step before. */
  gap?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function StepLink({ n, current, disabled = false, gap = false, onClick, children }: StepLinkProps) {
  return (
    <>
      {gap && <li className={styles.stepGap} aria-hidden="true" />}
      <li>
        <button
          type="button"
          className={cx(styles.step, current && styles.stepCurrent)}
          aria-current={current ? 'step' : undefined}
          disabled={disabled}
          onClick={onClick}
        >
          <span className={styles.stepNumber}>{n}</span>
          {children}
        </button>
      </li>
    </>
  );
}

// ---- Page 1: the course, the file, and what the reader made of it ----------------

interface DataStepProps {
  setup: StoredSetup;
  loader: BatchLoader;
  warnings: FileWarning[];
}

function DataStep({ setup, loader, warnings }: DataStepProps) {
  const { dataset, batch } = setup;
  const { importInfo } = loader;
  const ownBatch = dataset.source === 'file';
  const keepingNotice = batchKeepingNotice(loader.batchKeeping);
  // One instruction per place the code could run; the tabs pick between them.
  const instructions = useMemo(
    () =>
      Object.fromEntries(
        CODE_TARGETS.map((target) => [target.id, reshapeInstruction(batch, importInfo, warnings, target.id)]),
      ) as Record<CodeTarget, string>,
    [batch, importInfo, warnings],
  );

  return (
    <>
      <div>
        <h1 className={styles.title}>Your course and your batch</h1>
        <p className={styles.lede}>
          Name your course, load the spreadsheet of studies, and check how it was read. The next page shows every column
          as it is read, with the first rows of the data beside it.
        </p>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <Section
            title="Your course"
            description={`Written in the circle at the centre of the orbit, in up to ${COURSE_NAME_MAX_LENGTH} characters. Optional.`}
          >
            <Field label="Course name" aside={<span>{`${setup.courseName.length} / ${COURSE_NAME_MAX_LENGTH}`}</span>}>
              <Input
                className={styles.courseName}
                type="text"
                value={setup.courseName}
                maxLength={COURSE_NAME_MAX_LENGTH}
                placeholder={DEFAULT_COURSE_NAME}
                onChange={(event) => setup.setCourseName(event.target.value)}
              />
            </Field>
          </Section>
        </div>

        <div className={styles.card}>
          <Section
            title="Your batch"
            action={
              ownBatch ? (
                <FileButton accept={IMPORT_FILE_TYPES} onFile={loader.loadBatch} size="sm" variant="ghost">
                  Load another file
                </FileButton>
              ) : undefined
            }
          >
            {ownBatch ? (
              <>
                <p className={styles.fileName} title={dataset.name}>
                  {dataset.name}
                </p>
                <p className={styles.fileMeta}>
                  {dataset.rows.length} studies · {dataset.columns.length} columns
                </p>
              </>
            ) : (
              <>
                <p className={styles.fileMeta}>
                  CSV, TSV, XLSX or JSON, up to {MAX_ROWS} rows. Column names are read from the file, so nothing has to
                  be renamed first. The file is read in your browser and never uploaded.
                </p>
                <div className={styles.upload}>
                  <FileButton accept={IMPORT_FILE_TYPES} onFile={loader.loadBatch} variant="primary">
                    Choose a file
                  </FileButton>
                </div>
                <p className={styles.guideTitle}>What reads best</p>
                <ul className={styles.guide}>
                  {FILE_SHAPE.map(({ rule, detail }) => (
                    <li key={rule}>
                      <strong>{rule}</strong> {detail}
                    </li>
                  ))}
                </ul>
                <p className={styles.fileMeta}>
                  Not sure the file is in that shape? Load it anyway: it is checked here, and the check writes an
                  instruction you can hand to an AI assistant to reshape it.
                </p>
                <p className={styles.fileMeta}>
                  To change a site you published, load its <code>{SITE_CONFIG_FILE}</code>: everything you set comes
                  back.
                </p>
              </>
            )}
          </Section>
        </div>
      </div>

      {loader.error && <Notice tone="error">{loader.error}</Notice>}
      {ownBatch && keepingNotice && <Notice tone="warning">{keepingNotice}</Notice>}
      {ownBatch && importInfo && importInfo.keptRows < importInfo.totalRows && (
        <Notice tone="warning">
          The file holds {importInfo.totalRows} rows and the first {importInfo.keptRows} were kept.
        </Notice>
      )}

      {ownBatch && (
        <>
          <div className={styles.card}>
            <Section
              title="Column names"
              description="Which sheet the table is on, and the line the column names sit on. Every other choice is named by column, so this one comes first."
            >
              {hasFileReadingChoices(importInfo) ? (
                <div className={styles.readingFields}>
                  <FileReading importInfo={importInfo} onReimport={loader.reimport} />
                </div>
              ) : (
                <p className={styles.fileMeta}>
                  {importInfo
                    ? 'This file names its own columns, so there is nothing to choose.'
                    : 'This browser did not keep the file itself. To change which line the names are read from, load it again.'}
                </p>
              )}
            </Section>
          </div>

          <div className={styles.card}>
            <FileCheck warnings={warnings} instructions={instructions} />
          </div>
        </>
      )}
    </>
  );
}

// ---- Page 2: how each column's cells are read, beside the first rows ---------

function ColumnsStep({ setup, warnings }: { setup: StoredSetup; warnings: FileWarning[] }) {
  const { dataset, columns } = setup;
  // The column shown in detail beside the rules. It opens on the first
  // column, so the pane says what it is for before anything is clicked.
  const [inspected, setInspected] = useState<string | null>(() => dataset.columns[0]?.key ?? null);
  // What the file check said, under the rule of the column it said it about.
  const notes = useMemo(() => {
    const byColumn: Record<string, string> = {};
    for (const warning of warnings) {
      for (const key of warning.columns) byColumn[key] ??= capitalise(warning.message);
    }
    return byColumn;
  }, [warnings]);

  return (
    <div className={styles.sideLayout}>
      <div className={styles.sideSettings}>
        <div>
          <h1 className={styles.title}>How each column is read</h1>
          <p className={styles.lede}>
            Which cells hold one value and which hold several, what to cut off, and which numbers to group. The table
            beside this redraws as you change a rule; click a rule to bring its column into view, with every value it
            yields.
          </p>
        </div>
        <div className={styles.card}>
          <Section title="Column rules">
            <ColumnRulesFields
              rules={columns.rules}
              ruleChoices={columns.choices}
              onColumnRuleChange={columns.changeRule}
              inspected={inspected}
              onInspect={setInspected}
              notes={notes}
            />
          </Section>
        </div>
      </div>

      <div className={styles.sidePreview}>
        <div className={cx(styles.card, styles.previewCard)}>
          <Section
            title="Preview"
            description={`The first ${PREVIEW_ROWS} rows as they are read now. Cells holding several values are marked, and the column whose rule is in hand is lit.`}
          >
            <DataPreview dataset={dataset} highlightKey={inspected} />
            {inspected !== null && <ColumnValues dataset={dataset} columnKey={inspected} />}
          </Section>
        </div>
      </div>
    </div>
  );
}

/** A warning starts with a verb, read after its column's name; under the rule it stands alone. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---- Page 3: what the orbit does with the columns ------------------------------

function OrbitStep({ setup, appearance }: { setup: StoredSetup; appearance: Appearance }) {
  const { dataset, columns, tiers } = setup;

  return (
    <div className={styles.sideLayout}>
      <div className={styles.sideSettings}>
        <div>
          <h1 className={styles.title}>Your orbit</h1>
          <p className={styles.lede}>
            Which column the orbit uses for what, and how each study's ring is decided. The orbit beside this redraws as
            you change them.
          </p>
        </div>
        <div className={styles.card}>
          <Section title="Column roles" description="Which column the orbit uses for what.">
            <ColumnRoles dataset={dataset} mapping={columns.mapping} onMappingChange={columns.setMapping} />
          </Section>
        </div>
        <div className={styles.card}>
          <TierPanel locked={null} dataset={dataset} tiers={tiers} />
        </div>
      </div>

      <div className={styles.orbitPreview}>
        <OrbitCanvas
          model={setup.model}
          appearance={appearance}
          focusedRowId={null}
          centreLabel={setup.centreLabel}
          colourLabel={columns.mapping.colourKey}
          // Nothing to open here: the study table is beside the real orbit.
          onFocus={() => {}}
        />
      </div>
    </div>
  );
}
