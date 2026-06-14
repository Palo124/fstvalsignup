import { describe, expect, it } from 'vitest';
import {
  computeDayBounds,
  computeFreeWindows,
  festivalTimelineMinuteForNow,
  formatFestivalTimelineMinute,
  toMyScheduleBlocks,
} from './myScheduleTimeline';
import { parseTimeRange } from './time';
import type { ScheduleItem } from '../types/schedule';

function item(id: number, stage: string, timeLabel: string, attendees: string[] = []): ScheduleItem {
  const time = parseTimeRange(timeLabel);
  if (!time) {
    throw new Error(`Invalid time: ${timeLabel}`);
  }

  return {
    id,
    artist: `Artist ${id}`,
    stage,
    time,
    attendees,
  };
}

describe('computeDayBounds', () => {
  it('returns the earliest start and latest end on the festival timeline', () => {
    const bounds = computeDayBounds(
      [item(1, 'LOVE', '14:00–15:00'), item(2, 'EMPIRE', '18:00–19:00')],
      540,
    );

    expect(bounds).toEqual({ start: 840, end: 1140 });
  });
});

describe('computeFreeWindows', () => {
  it('finds gaps between joined performances', () => {
    const dayBounds = { start: 840, end: 1200 };
    const joined = [
      item(1, 'LOVE', '14:00–15:00', ['me']),
      item(2, 'EMPIRE', '16:00–17:00', ['me']),
    ];

    expect(computeFreeWindows(joined, dayBounds, 540)).toEqual([
      { start: 900, end: 960 },
      { start: 1020, end: 1200 },
    ]);
  });

  it('treats overlapping joined sets as one busy block', () => {
    const dayBounds = { start: 840, end: 1200 };
    const joined = [
      item(1, 'LOVE', '14:00–15:30', ['me']),
      item(2, 'EMPIRE', '15:00–16:00', ['me']),
    ];

    expect(computeFreeWindows(joined, dayBounds, 540)).toEqual([{ start: 960, end: 1200 }]);
  });
});

describe('formatFestivalTimelineMinute', () => {
  it('formats pre-dawn festival minutes as clock time', () => {
    expect(formatFestivalTimelineMinute(1500)).toBe('01:00');
  });
});

describe('festivalTimelineMinuteForNow', () => {
  it('maps afternoon time on the festival day', () => {
    const nowMs = Date.parse('2025-07-03T13:00:00.000Z');

    expect(festivalTimelineMinuteForNow(nowMs, '2025-07-03', '+02:00', 540)).toBe(900);
  });

  it('maps pre-dawn time to the previous festival day', () => {
    const nowMs = Date.parse('2025-07-04T00:00:00.000Z');

    expect(festivalTimelineMinuteForNow(nowMs, '2025-07-03', '+02:00', 540)).toBe(1560);
  });

  it('returns null outside the festival day window', () => {
    const nowMs = Date.parse('2025-07-04T08:00:00.000Z');

    expect(festivalTimelineMinuteForNow(nowMs, '2025-07-03', '+02:00', 540)).toBeNull();
  });
});

describe('toMyScheduleBlocks', () => {
  it('maps schedule items to timeline blocks', () => {
    expect(toMyScheduleBlocks([item(1, 'LOVE', '14:00–15:00', ['me'])], 540)).toEqual([
      {
        item: item(1, 'LOVE', '14:00–15:00', ['me']),
        start: 840,
        end: 900,
      },
    ]);
  });
});
