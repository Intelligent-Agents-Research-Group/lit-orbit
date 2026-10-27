import { useEffect, useRef, useState } from 'react';
import { COLOUR_MAX_CATEGORIES } from '../../config/defaults';
import type { ColumnInfo, ColumnMapping, ColumnRule, ColumnRules, Dataset } from '../../data/model';
import { ruleKey, ruleLabel, WHOLE, type ColumnRuleChoice } from '../../lib/columnRules';
import {
  colourColumnCandidates,
  sizeColumnCandidates,
  tierColumnCandidates,
  wedgeColumnCandidates,
} from '../../lib/dataset';
import type { ImportInfo } from '../../lib/importInfo';
import { cx } from '../../lib/cx';
import type { ParseOptions } from '../../lib/parse';
import { prettyKey } from '../../lib/text';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { Select, type SelectOption } from '../ui/Select';
import styles from './ColumnSettings.module.css';

/**
 * The three groups of settings that decide how a file is read. They live here
 * rather than in one panel because both places that ask about them - the
 * setup page a loaded file opens on, and the rail beside the orbit - need the
 * same controls, wired to the same state.
 */

const NONE = '';

// ---- Which sheet, and which line the column names sit on --------------------

/**
 * How long a typed row number is left alone before the file is read again.
 * Short enough that the table below answers while the box is still being
 * typed in, long enough that the two digits of "12" are one read rather than
 * a read of row 1 followed by a read of row 12.
 */
const REREAD_DELAY_MS = 250;

interface FileReadingProps {
  importInfo: ImportInfo;
  onReimport: (options: ParseOptions) => void;
}

export function FileReading({ importInfo, onReimport }: FileReadingProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Only ever set and cleared, never rendered, so a ref rather than state.
  const timer = useRef<number | undefined>(undefined);
  /**
   * The row and the callback as they are now, read inside the timer: a read
   * that lands while the user is still typing has to be compared against the
   * row in force when the timer fires, not the one at the keystroke that set
   * it.
   */
  const latest = useRef({ importInfo, onReimport });
  useEffect(() => {
    latest.current = { importInfo, onReimport };
  }, [importInfo, onReimport]);
  // A box left mid-edit must not read the file after it is gone.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  /**
   * While the box is being edited it shows the draft; the rest of the time it
   * shows the row the file was actually read from. Dropping the draft on
   * commit is what makes an unusable row number visibly snap back to the row
   * the reader fell back to, rather than leaving the box contradicting the
   * table on screen.
   */
  const value = draft ?? String(importInfo.headerRow);

  /** Read the file again, unless the box holds no row or the row in force. */
  const apply = (text: string) => {
    window.clearTimeout(timer.current);
    const row = Number.parseInt(text, 10);
    const { importInfo: info, onReimport: reimport } = latest.current;
    if (!Number.isFinite(row) || row < 0 || row === info.headerRow) return;
    reimport({ sheetIndex: info.sheetIndex, headerRow: row });
  };

  // Typing a row is enough to apply it: waiting for the box to be left would
  // leave the table below answering to a row that is no longer on screen.
  const edit = (text: string) => {
    setDraft(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => apply(text), REREAD_DELAY_MS);
  };

  const commit = () => {
    setDraft(null);
    apply(value);
  };

  return (
    <>
      {importInfo.sheetNames.length > 1 && (
        <Field label="Sheet" hint="The largest table in the workbook is picked by default">
          <Select
            value={String(importInfo.sheetIndex)}
            onChange={(sheet) => onReimport({ sheetIndex: Number(sheet) })}
            options={importInfo.sheetNames.map((sheet, index) => ({ value: String(index), label: sheet }))}
          />
        </Field>
      )}
      {importInfo.grid && (
        <Field label="Header row" hint="Line the column names are on, or 0 if the file has none">
          <Input
            className={styles.number}
            type="number"
            min={0}
            value={value}
            onChange={(event) => edit(event.target.value)}
            onBlur={commit}
            // Enter and leaving the box both skip the wait, and drop the
            // draft. Enter does it directly rather than by blurring the box:
            // calling blur() here does not always take, which leaves the box
            // showing a row that was never applied.
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
            }}
          />
        </Field>
      )}
    </>
  );
}

// ---- Which column plays which role ------------------------------------------

interface ColumnRolesProps {
  dataset: Dataset;
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

export function ColumnRoles({ dataset, mapping, onMappingChange }: ColumnRolesProps) {
  const options = (columns: ColumnInfo[]): SelectOption[] =>
    columns.map((column) => ({ value: column.key, label: column.key }));
  const colourable = colourColumnCandidates(dataset);
  const sizeColumns = sizeColumnCandidates(dataset);
  // A wedge and a ring each place a study somewhere, so both are picked from
  // columns that hold one value per row - see `wedgeColumnCandidates`.
  const wedgeColumns = wedgeColumnCandidates(dataset);
  const tierColumns = tierColumnCandidates(dataset);

  const update = (patch: Partial<ColumnMapping>) => onMappingChange({ ...mapping, ...patch });
  const keyOrNull = (value: string) => (value === NONE ? null : value);

  return (
    <>
      <Field label="Label column" hint="Names studies in lists, tooltips and the card">
        <Select
          value={mapping.labelKey ?? NONE}
          onChange={(v) => update({ labelKey: keyOrNull(v) })}
          options={options(dataset.columns)}
          placeholder="Row number"
        />
      </Field>
      <Field label="Wedges by" hint="Splits the circle into sectors; columns with one value per row">
        <Select
          value={mapping.wedgeKey ?? NONE}
          onChange={(v) => update({ wedgeKey: keyOrNull(v) })}
          options={options(wedgeColumns)}
          placeholder="No wedges"
          disabled={wedgeColumns.length === 0}
        />
      </Field>
      <Field label="Colour by" hint={'Columns with up to ' + COLOUR_MAX_CATEGORIES + ' values'}>
        <Select
          value={mapping.colourKey ?? NONE}
          onChange={(v) => update({ colourKey: keyOrNull(v) })}
          options={options(colourable)}
          placeholder="Single colour"
          disabled={colourable.length === 0}
        />
      </Field>
      <Field label="Dot size by" hint="Columns whose cells are mostly numbers">
        <Select
          value={mapping.sizeKey ?? NONE}
          onChange={(v) => update({ sizeKey: keyOrNull(v) })}
          options={options(sizeColumns)}
          placeholder="Same size"
          disabled={sizeColumns.length === 0}
        />
      </Field>
      <Field label="Tier column" hint="Whole numbers 1 to 5, one per row">
        <Select
          value={mapping.tierKey ?? NONE}
          onChange={(v) => update({ tierKey: keyOrNull(v) })}
          options={options(tierColumns)}
          placeholder="None"
          disabled={tierColumns.length === 0}
        />
      </Field>
    </>
  );
}

// ---- How each column's cells are read ---------------------------------------

interface ColumnRulesProps {
  rules: ColumnRules;
  ruleChoices: ColumnRuleChoice[];
  onColumnRuleChange: (key: string, rule: ColumnRule) => void;
  /**
   * The column shown in detail beside the rules, and how to change it. Only
   * the setup page has such a view; the rail beside the orbit leaves both out.
   */
  inspected?: string | null;
  onInspect?: (key: string) => void;
  /** What the file check said about a column, shown under its rule. */
  notes?: Record<string, string>;
}

export function ColumnRulesFields({
  rules,
  ruleChoices,
  onColumnRuleChange,
  inspected = null,
  onInspect,
  notes = {},
}: ColumnRulesProps) {
  return (
    <>
      <p className={styles.note}>
        How each column's cells were read. Change one when a cell holds several values, when only the first words of an
        answer are the answer, or when numbers read better in bands.
      </p>
      <ul className={styles.rules}>
        {ruleChoices.map(({ key, options }) => {
          const current = rules[key] ?? WHOLE;
          // A stored rule that is no longer on offer still has to show, or the
          // box would sit blank on the rule actually in force.
          const offered = options.some((option) => ruleKey(option) === ruleKey(current))
            ? options
            : [current, ...options];
          // A column with one way to read it is said rather than offered: a
          // dropdown with nothing to choose is a dead box, and a list of dead
          // boxes is most of what a tidy file gets.
          const fixed = offered.length < 2;
          const Name = fixed ? 'div' : 'label';
          const note = notes[key];
          return (
            // Focus reaching the dropdown - by a click on it or its name, or
            // by tabbing - brings the column into view beside it. So does a
            // click anywhere on the row, which is all a fixed one can take.
            <li
              key={key}
              className={cx(styles.rule, onInspect && styles.clickable, inspected === key && styles.inspected)}
              onFocus={onInspect && (() => onInspect(key))}
              onClick={onInspect && (() => onInspect(key))}
            >
              <Name className={styles.name}>
                <span className={styles.nameText}>{prettyKey(key)}</span>
                {fixed ? (
                  <span className={styles.fixed}>{ruleLabel(current)}</span>
                ) : (
                  <Select
                    value={ruleKey(current)}
                    onChange={(value) =>
                      onColumnRuleChange(key, offered.find((option) => ruleKey(option) === value) ?? WHOLE)
                    }
                    options={offered.map((option) => ({ value: ruleKey(option), label: ruleLabel(option) }))}
                  />
                )}
              </Name>
              {note && <p className={styles.warning}>{note}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
