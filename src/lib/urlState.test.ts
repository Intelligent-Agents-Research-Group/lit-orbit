import { describe, expect, it } from 'vitest';
import { formatUrlState, parseUrlState } from './urlState';

describe('formatUrlState', () => {
  it('names nothing when nothing is set', () => {
    expect(formatUrlState({ filters: {}, study: null })).toBe('');
    expect(formatUrlState({ filters: { Region: [] }, study: null })).toBe('');
  });

  it('writes the settings of the course, one column at a time', () => {
    const hash = formatUrlState({
      filters: { 'Course level': ['Introductory', 'Intermediate'], Region: ['Europe'] },
      study: null,
    });
    expect(hash).toBe('#course=Course%20level:Introductory,Intermediate;Region:Europe');
  });

  it('writes the study open in the panel', () => {
    expect(formatUrlState({ filters: {}, study: 12 })).toBe('#study=12');
    expect(formatUrlState({ filters: { Region: ['Asia'] }, study: 3 })).toBe('#course=Region:Asia&study=3');
  });

  it('encodes the separators wherever a name or value holds one', () => {
    const state = { filters: { 'a:b;c': ['x,y', 'p&q=r', '#'] }, study: null };
    expect(formatUrlState(state)).toBe('#course=a%3Ab%3Bc:x%2Cy,p%26q%3Dr,%23');
    expect(parseUrlState(formatUrlState(state)).filters).toEqual(state.filters);
  });

  it('survives a round trip through any script', () => {
    const state = { filters: { 课程层次: ['入门', 'Übung'] }, study: 7 };
    expect(parseUrlState(formatUrlState(state))).toEqual(state);
  });
});

describe('parseUrlState', () => {
  it('reads an empty fragment as an empty view', () => {
    expect(parseUrlState('')).toEqual({ filters: {}, study: null });
    expect(parseUrlState('#')).toEqual({ filters: {}, study: null });
  });

  it('reads a fragment with or without its hash', () => {
    const expected = { filters: { Region: ['Europe'] }, study: 4 };
    expect(parseUrlState('#course=Region:Europe&study=4')).toEqual(expected);
    expect(parseUrlState('course=Region:Europe&study=4')).toEqual(expected);
  });

  it('ignores what it does not know', () => {
    expect(parseUrlState('#foo=bar&course=Region:Asia&baz')).toEqual({ filters: { Region: ['Asia'] }, study: null });
  });

  it('drops a study that is not a row number', () => {
    expect(parseUrlState('#study=abc').study).toBeNull();
    expect(parseUrlState('#study=-1').study).toBeNull();
    expect(parseUrlState('#study=').study).toBeNull();
  });

  it('drops a column with no values, a value with no column, and repeats', () => {
    expect(parseUrlState('#course=Region:;:Asia;Level:Intro,Intro,').filters).toEqual({ Level: ['Intro'] });
  });

  it('drops a value it cannot decode rather than throwing', () => {
    expect(() => parseUrlState('#course=Region:%E0%A4%A')).not.toThrow();
    expect(parseUrlState('#course=Region:%E0%A4%A,Asia').filters).toEqual({ Region: ['Asia'] });
  });
});
