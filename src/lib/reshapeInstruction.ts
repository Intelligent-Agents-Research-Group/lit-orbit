import { MAX_ROWS } from '../config/defaults';
import { FILE_SHAPE } from '../config/fileShape';
import type { Dataset } from '../data/model';
import { delimiterName } from './columnRules';
import { filterMaxCategories } from './dataset';
import { asksTheUser, type FileWarning } from './fileCheck';
import type { ImportReading } from './importInfo';

/**
 * An instruction for an AI assistant, written for the user to paste: what the
 * file is, the shape Lit Orbit reads best, what the file check found, and a
 * request for the Python that writes a copy in that shape.
 *
 * It is written out rather than acted on because the app never sees an AI,
 * and should not: the file stays on the user's machine, and whether any of it
 * goes to an assistant is their call to make, with the text in front of them.
 * It names the file and its columns, which the code needs, and nothing of the
 * rows beyond the one cell a warning quotes.
 *
 * Some things only the user can say - what an unnamed column is called, what
 * each separator does in a column that uses several - so for those the AI is
 * told to ask them, all at once and before writing any code, rather than to
 * guess. The app asks nothing itself, and reads no column on more than one
 * separator: it only warns, and the AI's copy of the file is what settles it.
 */

/**
 * Where the user will run the code the AI writes, which decides how it is
 * asked for. The work is the same pandas in each case, and in each case it is
 * asked for as something to run top to bottom with nothing to edit along the
 * way - a script, or as few notebook cells as it takes - because the people
 * this is for want their file cleaned, not a notebook to step through. What
 * differs is how the file gets in and the result gets out. A single cell is
 * asked for, and assistants seldom give one, so nothing on the page promises
 * it: the answer is "code for a notebook, in one cell or a few".
 *
 * What the AI answers with, and what to do with it, are shown under the box
 * that holds the instruction rather than between the tabs and the box: a line
 * saying "one cell to paste into Colab" over the instruction read as if the
 * instruction itself went there.
 */
export const CODE_TARGETS = [
  {
    id: 'script',
    label: 'Python script',
    answer: 'one Python file',
    then: 'Save it next to your file and run it with one command. Needs Python and pandas.',
  },
  {
    id: 'notebook',
    label: 'Jupyter notebook',
    answer: 'code for a notebook, in one cell or a few',
    then: 'Paste it into a notebook beside your file, in the order given, and run it top to bottom.',
  },
  {
    id: 'colab',
    label: 'Google Colab',
    answer: 'code for a notebook, in one cell or a few',
    then: 'Paste it into a new Colab notebook, in the order given, and run it top to bottom, nothing installed: it asks for your file and hands the result back.',
  },
] as const;

export type CodeTarget = (typeof CODE_TARGETS)[number]['id'];

/** The script the instruction asks for, named so the terminal line can name it too. */
const SCRIPT_NAME = 'reshape_for_lit_orbit.py';

export function reshapeInstruction(
  batch: Dataset,
  reading: ImportReading | null,
  warnings: FileWarning[],
  target: CodeTarget,
): string {
  const lines: string[] = [];
  lines.push(
    'I have a spreadsheet of studies from a literature review that I want to load into Lit Orbit, a tool that reads CSV, TSV, XLSX and JSON files and reads every column on its own. Please write Python code, using pandas, that reads my file and writes a copy in the shape described below, delivered as described at the end. Keep every study and every column, change nothing but the shape, invent no values, and say what changed.',
    '',
    'My file',
    ...describeFile(batch, reading).map(bullet),
    '',
    'The shape Lit Orbit reads best',
    ...FILE_SHAPE.map((line) => bullet(`${line.rule} ${line.detail}`)),
    bullet(`Saved as UTF-8 CSV or as XLSX, with at most ${MAX_ROWS} rows.`),
    '',
    'What to change in my file',
  );
  if (warnings.length === 0) {
    lines.push(
      bullet(
        'Lit Orbit found nothing in particular. Check the file against the shape above and change only what strays from it.',
      ),
    );
  } else {
    if (warnings.some(asksTheUser)) {
      lines.push(
        'Some points below say to ask me something only I know. Ask me all of those questions together, in one message, before you write any code, and use my answers; where I give none, use the default the point names.',
      );
    }
    warnings.forEach((warning, index) => {
      const subject = warning.columns.length > 0 ? `${columnList(warning.columns)} ` : '';
      lines.push(`${index + 1}. ${subject}${warning.message} ${fixFor(warning)}`);
    });
  }
  lines.push(
    bullet(
      `In every other column that holds several values per cell, check for a second separator. A column can separate values with more than one character ("A; B, C"), and splitting on one leaves pieces that still hold the other: split on the main separator, then look at what remains for another character that sits between values (another of ; , / | or a line break, or " + ", " & ", the word "and"); if there is one, split on it too, and write every value separated by a semicolon. The sign of it is that splitting on one character lowers the number of distinct values, yet more remain than Lit Orbit can filter on (${filterMaxCategories(batch.rows.length)} at most for this file). If no second separator is found and too many values remain, merge them into fewer categories, one spelling each.`,
    ),
    '',
    'How to deliver it',
    ...delivery(target, batch.name).map(bullet),
    bullet('Do not rename, reorder or drop columns unless a point above asks for it.'),
  );
  return lines.join('\n');
}

/** The change a warning asks for, or the question the AI is to ask the user first. */
function fixFor(warning: FileWarning): string {
  if (warning.separators && warning.columns.length === 1) {
    return separatorQuestion(warning.columns[0], warning.separators);
  }
  if (warning.names && warning.names.length > 0) {
    if (warning.kind === 'no-header') {
      return 'Ask me what each column is called, in order; a column I give no name keeps the name it has here ("Column 1", "Column 2" and so on). Then add the names as a line at the top of the table.';
    }
    const placed = warning.names.map((key) => `the ${position(key)} column ("${key}")`);
    const one = warning.names.length === 1;
    return `Ask me what to call ${prose(placed)}, and write ${one ? 'the name' : 'the names'} on the header line; a column I give no name keeps the name it has here.`;
  }
  return warning.fix;
}

/**
 * The question to ask about a column that uses several separators. Lit Orbit
 * splits a column on one character and reads no column on two, so whatever
 * the user answers has to leave one separator at most in the column; left
 * unanswered, the main one is kept and the rest are rewritten as it.
 */
function separatorQuestion(key: string, separators: readonly string[]): string {
  const [main, ...rest] = separators;
  return `Ask me what each of ${prose(separators.map(delimiterName))} does in this column: separating values that stay in one cell, splitting the column into separate columns ("${key} 1", "${key} 2" and so on, in order), or just part of the text. The column can keep one separator at most, since Lit Orbit splits a column on one character only and does not adapt to more; any other separator between values is rewritten as the kept one. If I do not say, keep ${delimiterName(main)} and rewrite ${prose(rest.map(delimiterName))} as it.`;
}

/** "Column 3" -> "3rd": where a column Lit Orbit named by position sits. */
function position(key: string): string {
  const n = /^Column (\d+)$/.exec(key)?.[1];
  return n === undefined ? `"${key}"` : ordinal(Number(n));
}

/** "a, b and c". */
function prose(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** How the code is asked for: one script, or cells for a notebook here or on Colab. */
function delivery(target: CodeTarget, name: string): string[] {
  const output = outputName(name);
  const xlsx = isWorkbook(name);
  const openpyxl = xlsx ? ' If openpyxl may be missing, the code installs it first with %pip install -q openpyxl.' : '';
  const where = (() => {
    switch (target) {
      case 'script':
        return [
          `One Python script, ${SCRIPT_NAME}, that I save next to my file and run with one command: python ${SCRIPT_NAME}. The file name "${name}" is set on its first lines, and a path given after the command is used instead.`,
          `It reads the file, makes every change above and writes the result next to it as "${output}".`,
        ];
      case 'notebook':
        return [
          `Code for a Jupyter notebook that I paste into a notebook in the folder that holds my file and run top to bottom: as few cells as it takes, one if it can be, with nothing to edit between them. The file name "${name}" is set on its first line.${openpyxl}`,
          `It reads the file, makes every change above and writes the result next to the original as "${output}".`,
        ];
      case 'colab':
        return [
          `Code for a Google Colab notebook that I paste into a new notebook and run top to bottom: as few cells as it takes, one if it can be, with nothing to edit between them. It asks for my file with files.upload() from google.colab, reads it under the name it was uploaded as, makes every change above, writes "${output}" and hands it back with files.download().${openpyxl}`,
        ];
    }
  })();
  return [
    ...where,
    `Keep it as short and as easy to run as you can: put my answers to your questions into the code, leave nothing for me to set, call or edit before it runs${target === 'colab' ? '' : ' beyond the file name'}, and need nothing beyond pandas${xlsx ? ' and openpyxl' : ''}.`,
    'At the end, print a short summary of what changed: the rows and columns before and after, and each column that changed with its number of distinct values before and after.',
  ];
}

function describeFile(batch: Dataset, reading: ImportReading | null): string[] {
  const lines = [`Name: ${batch.name}${format(batch.name)}`];
  if (reading && reading.sheetNames.length > 1) {
    lines.push(
      `Sheet: "${reading.sheetNames[reading.sheetIndex]}" (${ordinal(reading.sheetIndex + 1)} of ${reading.sheetNames.length}).`,
    );
  }
  if (reading && reading.grid) {
    lines.push(
      reading.headerRow === 0
        ? 'The table has no line of column names, so the columns are numbered.'
        : `The column names are on line ${reading.headerRow}.`,
    );
  }
  lines.push(`${batch.rows.length} rows of studies, ${batch.columns.length} columns.`);
  lines.push(`Columns, in order: ${columnList(batch.columns.map((column) => column.key))}.`);
  return lines;
}

function extension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function isWorkbook(name: string): boolean {
  return ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension(name));
}

/** What the extension says the file is, when it says anything. */
function format(name: string): string {
  if (isWorkbook(name)) return ' (an Excel workbook)';
  switch (extension(name)) {
    case 'csv':
      return ' (a CSV file)';
    case 'tsv':
      return ' (a tab-separated file)';
    case 'json':
      return ' (a JSON file)';
    default:
      return '';
  }
}

/** "batch.xlsx" -> "batch-for-lit-orbit.xlsx"; a name with no extension gets ".csv". */
function outputName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const suffix = dot > 0 ? name.slice(dot) : '.csv';
  return `${stem}-for-lit-orbit${suffix}`;
}

function columnList(keys: string[]): string {
  return keys.map((key) => `"${key}"`).join(', ');
}

function bullet(text: string): string {
  return `- ${text}`;
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}
