import { describe, expect, it } from 'vitest';
import { applyScheduleFilters, maxAttendeeCount } from './filters';
import { parseTimeRange } from './time';
import type { ScheduleItem } from '../types/schedule';

function item(id: number, attendees: string[]): ScheduleItem {
  const time = parseTimeRange('14:00–15:00');
  if (!time) {
    throw new Error('Invalid time');
  }

  return {
    id,
    artist: `Artist ${id}`,
    stage: 'LOVE',
    time,
    attendees,
  };
}

const emptyFilters = {
  attendees: [],
  stages: [],
  overlapsOnly: false,
  joinedOnly: false,
  hasJoinersOnly: false,
  popularOnly: false,
};

describe('applyScheduleFilters', () => {
  it('keeps only performances tied for the most joiners', () => {
    const items = [item(1, ['a', 'b', 'c']), item(2, ['d']), item(3, ['e', 'f', 'g'])];

    expect(
      applyScheduleFilters(items, { ...emptyFilters, popularOnly: true }, new Map(), ''),
    ).toEqual([item(1, ['a', 'b', 'c']), item(3, ['e', 'f', 'g'])]);
  });

  it('returns nothing when no one has joined and popular filter is on', () => {
    expect(
      applyScheduleFilters([item(1, []), item(2, [])], { ...emptyFilters, popularOnly: true }, new Map(), ''),
    ).toEqual([]);
  });

  it('keeps only performances with at least one joiner', () => {
    const items = [item(1, []), item(2, ['a']), item(3, ['b', 'c'])];

    expect(
      applyScheduleFilters(items, { ...emptyFilters, hasJoinersOnly: true }, new Map(), ''),
    ).toEqual([item(2, ['a']), item(3, ['b', 'c'])]);
  });

  it('applies popular filter after other lineup filters', () => {
    const items = [item(1, ['a', 'b']), item(2, ['a', 'b', 'c']), item(3, ['a'])];

    expect(
      applyScheduleFilters(
        items,
        { ...emptyFilters, attendees: ['a'], popularOnly: true },
        new Map(),
        '',
      ),
    ).toEqual([item(2, ['a', 'b', 'c'])]);
  });
});

describe('maxAttendeeCount', () => {
  it('returns the highest attendee count on the list', () => {
    expect(maxAttendeeCount([item(1, ['a']), item(2, ['a', 'b', 'c'])])).toBe(3);
  });
});
