import { describe, expect, it } from 'vitest';
import { intervalDates, festivalEndMinutes, parseTimeRange, sortStartMinutes } from './time';

describe('parseTimeRange', () => {
  it('parses same-day ranges', () => {
    expect(parseTimeRange('18:30–20:00')).toEqual({
      label: '18:30–20:00',
      startMinutes: 1110,
      endMinutes: 1200,
    });
  });

  it('parses overnight ranges', () => {
    expect(parseTimeRange('23:30–01:00')).toMatchObject({
      startMinutes: 1410,
      endMinutes: 1500,
    });
  });

  it('rejects invalid clock values', () => {
    expect(parseTimeRange('25:00–26:00')).toBeNull();
  });
});

describe('sortStartMinutes', () => {
  it('moves pre-dawn shows to the next festival block', () => {
    const range = parseTimeRange('02:00–03:00');

    expect(range && sortStartMinutes(range, 300)).toBe(1560);
  });
});

describe('festivalEndMinutes', () => {
  it('extends pre-dawn end times on the festival timeline', () => {
    const range = parseTimeRange('02:00–03:00');

    expect(range && festivalEndMinutes(range, 300)).toBe(1620);
  });

  it('keeps overnight end times when the set starts in the evening', () => {
    const range = parseTimeRange('23:30–01:00');

    expect(range && festivalEndMinutes(range, 300)).toBe(1500);
  });
});

describe('intervalDates', () => {
  it('maps pre-dawn shows to the next calendar date', () => {
    const range = parseTimeRange('02:00–03:00');

    expect(range).not.toBeNull();
    const { start, end } = intervalDates('2025-07-02', range!, '+02:00', 300);

    expect(start.toISOString()).toBe('2025-07-03T00:00:00.000Z');
    expect(end.toISOString()).toBe('2025-07-03T01:00:00.000Z');
  });
});
