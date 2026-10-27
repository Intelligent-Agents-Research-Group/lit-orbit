/**
 * The shape of table the reader does best with, said once: on the setup page
 * before a file is chosen, and in the instruction the file check writes for
 * an AI to reshape a file that strays from it. Each line is a rule and the
 * reason behind it, in the reader's terms - see `lib/parse.ts` for the header
 * search and `lib/columnRules.ts` for how a cell becomes values.
 */
export const FILE_SHAPE = [
  {
    rule: 'One table, one study per row.',
    detail:
      'The column names on one line at the top; notes, titles, totals and a second table on another sheet or in another file.',
  },
  {
    rule: 'One question per column, answered in a few words.',
    detail:
      'Short values that repeat across studies ("RCT", "Quasi-experimental") can be filtered, coloured and cut into wedges; a sentence cannot.',
  },
  {
    rule: 'Several answers in one cell separated the same way throughout the column.',
    detail: 'A semicolon is safest ("Code generation; Debugging"). A column is split on one character only.',
  },
  {
    rule: 'Numbers as plain numbers.',
    detail:
      '150, not "150 students" or "~150"; units and remarks in a column of their own. Tiers as whole numbers 1 to 5.',
  },
] as const;
