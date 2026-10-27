import { describe, expect, it } from 'vitest';
import { layoutCentreLabel, type CentreRoom } from './centreLabel';

/**
 * A stand-in for the canvas at 12px: capitals wider than small letters and a
 * narrow space, which is enough to tell "GenAI and" from "and CS Ed".
 */
const FONT_SIZE = 12;
const measure = (text: string) =>
  [...text].reduce((width, char) => width + (char === ' ' ? 3 : char === char.toUpperCase() ? 8 : 6), 0);

const ROOM: CentreRoom = {
  radius: 26,
  maxRadius: 45,
  fontSize: FONT_SIZE,
  minFontSize: 9,
};

/** Width of a laid-out line at the size it is drawn. */
const drawnWidth = (text: string, fontSize: number) => (measure(text) * fontSize) / FONT_SIZE;

describe('layoutCentreLabel', () => {
  it('leaves a short name on one line in the circle as it is', () => {
    const layout = layoutCentreLabel('CS1', measure, ROOM);
    expect(layout.lines.map((line) => line.text)).toEqual(['CS1']);
    expect(layout.lines[0].y).toBe(0);
    expect(layout.radius).toBe(ROOM.radius);
    expect(layout.fontSize).toBe(FONT_SIZE);
  });

  it('breaks a longer name where its widest line is narrowest', () => {
    const layout = layoutCentreLabel('GenAI and CS Ed', measure, ROOM);
    expect(layout.lines.map((line) => line.text)).toEqual(['GenAI', 'and CS Ed']);
  });

  it('takes a third line when it saves a good deal of room', () => {
    const layout = layoutCentreLabel('Intro to Computer Science', measure, {
      ...ROOM,
      maxRadius: 100,
    });
    expect(layout.lines.map((line) => line.text)).toEqual(['Intro to', 'Computer', 'Science']);
  });

  it('never breaks a word, and keeps the words in order', () => {
    const name = 'Data Structures and Algorithms';
    const layout = layoutCentreLabel(name, measure, ROOM);
    expect(layout.lines.map((line) => line.text).join(' ')).toBe(name);
    expect(layout.lines.length).toBeLessThanOrEqual(3);
  });

  it('stacks the lines about the centre, top to bottom', () => {
    const ys = layoutCentreLabel('Intro to Computer Science', measure, {
      ...ROOM,
      maxRadius: 100,
    }).lines.map((line) => line.y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[0] + ys[2]).toBeCloseTo(0);
  });

  it('grows the circle to hold the name at its full size, with every line inside it', () => {
    const layout = layoutCentreLabel('GenAI and CS Ed', measure, ROOM);
    expect(layout.radius).toBeGreaterThan(ROOM.radius);
    expect(layout.radius).toBeLessThanOrEqual(ROOM.maxRadius);
    expect(layout.fontSize).toBe(FONT_SIZE);
    for (const line of layout.lines)
      expect(drawnWidth(line.text, layout.fontSize)).toBeLessThanOrEqual(line.maxWidth + 1e-9);
  });

  it('shrinks the text once the circle can grow no further', () => {
    const layout = layoutCentreLabel('GenAI and CS Ed', measure, {
      ...ROOM,
      maxRadius: 32,
    });
    expect(layout.radius).toBe(32);
    expect(layout.fontSize).toBeLessThan(FONT_SIZE);
    expect(layout.fontSize).toBeGreaterThan(ROOM.minFontSize);
    for (const line of layout.lines)
      expect(drawnWidth(line.text, layout.fontSize)).toBeLessThanOrEqual(line.maxWidth + 1e-9);
  });

  it('condenses what still does not fit at the smallest size', () => {
    const layout = layoutCentreLabel('GenAI and CS Ed', measure, {
      ...ROOM,
      maxRadius: 20,
    });
    expect(layout.fontSize).toBe(ROOM.minFontSize);
    expect(layout.lines.some((line) => drawnWidth(line.text, layout.fontSize) > line.maxWidth)).toBe(true);
  });

  it('breaks a name the same way however much room there is', () => {
    const texts = (room: CentreRoom) => layoutCentreLabel('GenAI and CS Ed', measure, room).lines.map((l) => l.text);
    expect(texts({ ...ROOM, radius: 60, maxRadius: 100 })).toEqual(texts(ROOM));
    expect(texts({ ...ROOM, radius: 10, maxRadius: 15 })).toEqual(texts(ROOM));
  });

  it('writes nothing for an empty name', () => {
    expect(layoutCentreLabel('   ', measure, ROOM).lines).toEqual([]);
  });
});
