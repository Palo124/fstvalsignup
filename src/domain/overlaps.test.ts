import { describe, expect, it } from 'vitest';
import { computeOverlaps } from './overlaps';
import { parseTimeRange } from './time';
import type { ScheduleItem } from '../types/schedule';

const preDawnCutoffMinutes = 11 * 60;

describe('computeOverlaps', () => {
  it('maps each overlapping show to its collision partners', () => {
    const items: ScheduleItem[] = [
      item(1, '18:00-19:00', ['Pavol']),
      item(2, '18:30-19:30', ['Pavol']),
      item(3, '19:30-20:30', ['Pavol']),
      item(4, '18:45-19:15', ['Someone Else']),
    ];

    const overlaps = computeOverlaps(items, 'Pavol', preDawnCutoffMinutes);

    expect(overlaps.get(1)).toEqual([
      {
        id: 2,
        artist: 'Artist 2',
        stage: 'Main',
        timeLabel: '18:30-19:30',
      },
    ]);
    expect(overlaps.get(2)).toEqual([
      {
        id: 1,
        artist: 'Artist 1',
        stage: 'Main',
        timeLabel: '18:00-19:00',
      },
    ]);
    expect(overlaps.has(3)).toBe(false);
    expect(overlaps.has(4)).toBe(false);
  });

  it('returns no overlaps without a nickname', () => {
    expect(computeOverlaps([item(1, '18:00-19:00', ['Pavol'])], '', preDawnCutoffMinutes).size).toBe(0);
  });

  it('does not treat evening and pre-dawn shows as overlapping', () => {
    const items: ScheduleItem[] = [
      item(1, '22:00-23:00', ['Pavol']),
      item(2, '01:00-02:00', ['Pavol']),
    ];

    expect(computeOverlaps(items, 'Pavol', preDawnCutoffMinutes).size).toBe(0);
  });

  it('detects overlap between a late-night set and pre-dawn continuation', () => {
    const items: ScheduleItem[] = [
      item(1, '23:00-02:00', ['Pavol']),
      item(2, '01:00-02:00', ['Pavol']),
    ];

    const overlaps = computeOverlaps(items, 'Pavol', preDawnCutoffMinutes);

    expect(overlaps.get(1)).toEqual([
      {
        id: 2,
        artist: 'Artist 2',
        stage: 'Main',
        timeLabel: '01:00-02:00',
      },
    ]);
    expect(overlaps.get(2)).toEqual([
      {
        id: 1,
        artist: 'Artist 1',
        stage: 'Main',
        timeLabel: '23:00-02:00',
      },
    ]);
  });
});

function item(id: number, label: string, attendees: string[]): ScheduleItem {
  const time = parseTimeRange(label);
  if (!time) {
    throw new Error(`Invalid test time range: ${label}`);
  }

  return {
    id,
    artist: `Artist ${id}`,
    stage: 'Main',
    time,
    attendees,
  };
}
