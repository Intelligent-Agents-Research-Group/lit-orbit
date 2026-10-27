import { describe, expect, it } from 'vitest';
import { fitToWidth, prettyKey } from './text';

/** A stand-in for canvas measuring: one unit per character. */
const measure = (text: string) => text.length;

describe('prettyKey', () => {
  it('reads underscores and hyphens as spaces', () => {
    expect(prettyKey('course_level')).toBe('course level');
    expect(prettyKey('course-level')).toBe('course level');
  });
});

describe('fitToWidth', () => {
  it('leaves text that already fits alone', () => {
    expect(fitToWidth('Pair Programmer', 20, measure)).toBe('Pair Programmer');
  });

  it('cuts text that does not fit and marks the cut', () => {
    expect(fitToWidth('Open-ended Use', 8, measure)).toBe('Open-en…');
  });

  it('does not leave a space in front of the ellipsis', () => {
    expect(fitToWidth('Other Teachable Agent', 7, measure)).toBe('Other…');
  });

  it('gives up rather than overflowing when there is room for nothing', () => {
    expect(fitToWidth('Writing Partner', 0, measure)).toBe('');
  });
});
