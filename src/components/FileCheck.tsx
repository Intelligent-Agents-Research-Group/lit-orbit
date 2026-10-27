import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { asksTheUser, type FileWarning } from '../lib/fileCheck';
import { CODE_TARGETS, type CodeTarget } from '../lib/reshapeInstruction';
import { storageKey } from '../lib/storage';
import { prettyKey } from '../lib/text';
import { CopyBox } from './ui/CopyBox';
import { Section } from './ui/Section';
import { Tabs } from './ui/Tabs';
import styles from './FileCheck.module.css';

interface FileCheckProps {
  warnings: FileWarning[];
  /** The instruction for an AI assistant, per place the code will run - see `lib/reshapeInstruction.ts`. */
  instructions: Record<CodeTarget, string>;
}

/**
 * What the file check found, and the way out when it found something: an
 * instruction to hand to an AI assistant, which writes the code that
 * reshapes the file. The instruction is offered even when nothing was found,
 * folded away, because the check sees only the shapes it was taught.
 *
 * Which kind of code is asked for - a script, a notebook, a notebook on
 * Colab - is a question about the user's tools rather than their file, so
 * the answer is kept with the light / dark choice rather than with the batch.
 *
 * The box holds text for an AI, and what the AI answers is what goes into the
 * notebook or Colab, so that is said under the box, after it: said over the
 * box, "paste this into Colab" reads as being about the text below it.
 */
export function FileCheck({ warnings, instructions }: FileCheckProps) {
  const clean = warnings.length === 0;
  const [stored, setTarget] = useLocalStorageState<CodeTarget>(storageKey('codeTarget'), CODE_TARGETS[0].id);
  // A value stored by a version with other tabs would leave the box empty.
  const target = CODE_TARGETS.some((candidate) => candidate.id === stored) ? stored : CODE_TARGETS[0].id;
  const chosen = CODE_TARGETS.find((candidate) => candidate.id === target) ?? CODE_TARGETS[0];

  return (
    <Section
      title="File check"
      description="What the reader noticed about the shape of the table. Each point is a guess from the cells, so the file may be right as it is."
    >
      {clean ? (
        <p className={styles.clean}>
          Nothing stood out. The next page shows every column as it is read, which is where a cell that reads oddly
          shows up.
        </p>
      ) : (
        <ul className={styles.warnings}>
          {warnings.map((warning, index) => (
            <li key={index} className={styles.warning}>
              {warning.columns.length > 0 && (
                <>
                  <strong className={styles.columns}>{warning.columns.map(prettyKey).join(', ')}</strong>{' '}
                </>
              )}
              {warning.message}
            </li>
          ))}
        </ul>
      )}
      <details className={styles.details} open={!clean}>
        <summary className={styles.summary}>Ask an AI to reshape the file</summary>
        <p className={styles.note}>
          Copy the text below into an AI assistant such as ChatGPT or Claude: it writes the Python that saves a copy of
          the file in the shape Lit Orbit reads best{clean ? '' : ', with each point above put right'}.
          {warnings.some(asksTheUser) && ' It first asks you what only you can say, such as what to call a column.'}{' '}
          Nothing leaves this page: the text is yours to take. It names the file and its columns, and quotes no cell
          beyond the one a point above quotes.
        </p>
        <p className={styles.question}>
          Where will you run the code the AI writes?{' '}
          <span className={styles.hint}>Pick before you copy: the text asks for code in that form.</span>
        </p>
        <Tabs tabs={CODE_TARGETS} selected={target} onSelect={setTarget} label="Where you will run the AI's code">
          <CopyBox value={instructions[target]} label="Instruction for an AI assistant" />
          <p className={styles.afterwards}>
            <strong>What the AI gives back:</strong> {chosen.answer}. {chosen.then}
          </p>
        </Tabs>
      </details>
    </Section>
  );
}
