import { describe, expect, it } from 'vitest';
import { computeOverlaps } from './overlaps';
import type { ScheduleItem } from '../types/schedule';

describe('computeOverlaps', () => {
  it('maps each overlapping show to its collision partners', () => {
    const items: ScheduleItem[] = [
      item(1, '18:00-19:00', ['Pavol']),
      item(2, '18:30-19:30', ['Pavol']),
      item(3, '19:30-20:30', ['Pavol']),
      item(4, '18:45-19:15', ['Someone Else']),
    ];

    const overlaps = computeOverlaps(items, 'Pavol');

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
    expect(computeOverlaps([item(1, '18:00-19:00', ['Pavol'])], '').size).toBe(0);
  });
});

function item(id: number, label: string, attendees: string[]): ScheduleItem {
  const [start, end] = label.split('-').map((value) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  });

  return {
    id,
    artist: `Artist ${id}`,
    stage: 'Main',
    time: {
      label,
      startMinutes: start,
      endMinutes: end,
    },
    attendees,
  };
}
