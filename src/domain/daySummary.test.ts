import { describe, expect, it } from 'vitest';
import { computeDaySummary, formatDaySummary } from './daySummary';
import type { OverlapMap } from './overlaps';
import type { ScheduleItem } from '../types/schedule';

function item(id: number, attendees: string[] = []): ScheduleItem {
  return {
    id,
    artist: `Artist ${id}`,
    stage: 'Main',
    time: { label: '12:00–13:00', startMinutes: 720, endMinutes: 780 },
    attendees,
  };
}

describe('computeDaySummary', () => {
  it('counts joined shows and conflicts for the current user', () => {
    const items = [item(1, ['me']), item(2, ['me']), item(3, ['other'])];
    const overlaps: OverlapMap = new Map([[1, [{ id: 2, artist: 'Artist 2', stage: 'Main', timeLabel: '12:30–13:30' }]]]);

    expect(computeDaySummary(items, overlaps, 'me', items)).toEqual({
      totalShows: 3,
      joinedCount: 2,
      conflictCount: 1,
      visibleShows: 3,
    });
  });

  it('tracks visible count separately from total shows', () => {
    const items = [item(1), item(2), item(3)];
    const visible = [item(1)];

    expect(computeDaySummary(items, new Map(), '', visible)).toEqual({
      totalShows: 3,
      joinedCount: 0,
      conflictCount: 0,
      visibleShows: 1,
    });
  });
});

describe('formatDaySummary', () => {
  it('includes joined and conflict counts when a nickname is set', () => {
    const text = formatDaySummary(
      {
        totalShows: 40,
        joinedCount: 5,
        conflictCount: 2,
        visibleShows: 40,
      },
      'me',
    );

    expect(text).toBe('5 joined · 2 conflicts · 40 shows');
  });

  it('omits conflict text when there are none', () => {
    const text = formatDaySummary(
      {
        totalShows: 12,
        joinedCount: 3,
        conflictCount: 0,
        visibleShows: 8,
      },
      'me',
    );

    expect(text).toBe('3 joined · 12 shows · 8 visible');
  });

  it('shows only totals when no nickname is set', () => {
    const text = formatDaySummary(
      {
        totalShows: 12,
        joinedCount: 0,
        conflictCount: 0,
        visibleShows: 12,
      },
      '',
    );

    expect(text).toBe('12 shows');
  });
});
