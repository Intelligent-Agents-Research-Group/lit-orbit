import { describe, expect, it } from 'vitest';
import { cellNumber, cellText, cellValues } from './model';

describe('reading a cell', () => {
  it('reads a list, a single value and an empty cell the same way', () => {
    expect(cellValues({ a: ['x', 'y'] }, 'a')).toEqual(['x', 'y']);
    expect(cellValues({ a: 'x' }, 'a')).toEqual(['x']);
    expect(cellValues({ a: null }, 'a')).toEqual([]);
    expect(cellValues({}, null)).toEqual([]);
    expect(cellText({ a: ['x', 'y'] }, 'a')).toBe('x, y');
  });

  it('reads a number, however it was stored', () => {
    expect(cellNumber({ n: 150 }, 'n')).toBe(150);
    expect(cellNumber({ n: '150' }, 'n')).toBe(150);
    expect(cellNumber({ n: ' 150 ' }, 'n')).toBe(150);
  });

  /**
   * A column is offered as a dot size when most of its cells are numbers, on
   * the promise that the rest are drawn at the default size. Reading the
   * digits off the front of a cell broke that promise quietly: the shipped
   * batch's "150 + ?" was sized as 150 studies, and a leading number above the
   * column's measured end drew a dot larger than the largest count in it.
   */
  it('refuses a cell that only begins with digits', () => {
    expect(cellNumber({ n: '150 + ?' }, 'n')).toBeUndefined();
    expect(cellNumber({ n: '1,200' }, 'n')).toBeUndefined();
    expect(cellNumber({ n: '2000 (approx)' }, 'n')).toBeUndefined();
    expect(cellNumber({ n: '32-43' }, 'n')).toBeUndefined();
    expect(cellNumber({ n: 'Not Reported' }, 'n')).toBeUndefined();
  });

  it('reads an empty cell as no number rather than as zero', () => {
    expect(cellNumber({ n: '' }, 'n')).toBeUndefined();
    expect(cellNumber({ n: '   ' }, 'n')).toBeUndefined();
    expect(cellNumber({ n: null }, 'n')).toBeUndefined();
    expect(cellNumber({}, null)).toBeUndefined();
  });
});
