import { describe, expect, it } from 'vitest';
import { computeOverlaps } from './overlaps';
import type { ScheduleItem } from '../types/schedule';

describe('computeOverlaps', () => {
  it('flags only overlapping shows for the current attendee', () => {
    const items: ScheduleItem[] = [
      item(1, '18:00-19:00', ['Pavol']),
      item(2, '18:30-19:30', ['Pavol']),
      item(3, '19:30-20:30', ['Pavol']),
      item(4, '18:45-19:15', ['Someone Else']),
    ];

    expect([...computeOverlaps(items, 'Pavol')].sort()).toEqual([1, 2]);
  });

  it('returns no overlaps without a nickname', () => {
    expect(computeOverlaps([item(1, '18:00-19:00', ['Pavol'])], '')).toEqual(new Set());
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
