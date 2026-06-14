import { festivalTimelineMinutes } from './time';
import type { ScheduleItem } from '../types/schedule';

export interface TimelineInterval {
  start: number;
  end: number;
}

export interface MyScheduleBlock {
  item: ScheduleItem;
  start: number;
  end: number;
}

const MIN_FREE_WINDOW_MINUTES = 15;

export function computeDayBounds(
  items: ScheduleItem[],
  preDawnCutoffMinutes: number,
): TimelineInterval | null {
  if (items.length === 0) {
    return null;
  }

  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const timeline = festivalTimelineMinutes(item.time, preDawnCutoffMinutes);
    start = Math.min(start, timeline.start);
    end = Math.max(end, timeline.end);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return { start, end };
}

export function toMyScheduleBlocks(
  items: ScheduleItem[],
  preDawnCutoffMinutes: number,
): MyScheduleBlock[] {
  return items.map((item) => {
    const timeline = festivalTimelineMinutes(item.time, preDawnCutoffMinutes);
    return {
      item,
      start: timeline.start,
      end: timeline.end,
    };
  });
}

export function computeFreeWindows(
  joinedItems: ScheduleItem[],
  dayBounds: TimelineInterval,
  preDawnCutoffMinutes: number,
  minGapMinutes = MIN_FREE_WINDOW_MINUTES,
): TimelineInterval[] {
  if (joinedItems.length === 0) {
    return [dayBounds];
  }

  const intervals = joinedItems
    .map((item) => festivalTimelineMinutes(item.time, preDawnCutoffMinutes))
    .sort((left, right) => left.start - right.start);

  const merged = mergeIntervals(intervals);
  const gaps: TimelineInterval[] = [];
  let cursor = dayBounds.start;

  for (const interval of merged) {
    if (interval.start - cursor >= minGapMinutes) {
      gaps.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (dayBounds.end - cursor >= minGapMinutes) {
    gaps.push({ start: cursor, end: dayBounds.end });
  }

  return gaps;
}

export function formatFestivalTimelineMinute(minutes: number): string {
  const clockMinutes = minutes >= 24 * 60 ? minutes - 24 * 60 : minutes;
  const hour = Math.floor(clockMinutes / 60);
  const minute = clockMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function timelineHourMarks(
  dayBounds: TimelineInterval,
  stepMinutes = 60,
): number[] {
  const first = Math.ceil(dayBounds.start / stepMinutes) * stepMinutes;
  const marks: number[] = [];

  for (let minute = first; minute <= dayBounds.end; minute += stepMinutes) {
    marks.push(minute);
  }

  return marks;
}

export function festivalTimelineMinuteForNow(
  nowMs: number,
  dayDate: string | undefined,
  timeZoneOffset: string,
  preDawnCutoffMinutes: number,
): number | null {
  if (!dayDate) {
    return null;
  }

  const { isoDate, minutes } = zonedDateParts(nowMs, timeZoneOffset);
  const nextDay = addOneDay(dayDate);

  if (isoDate === dayDate && minutes >= preDawnCutoffMinutes) {
    return minutes;
  }

  if (isoDate === nextDay && minutes < preDawnCutoffMinutes) {
    return minutes + 24 * 60;
  }

  return null;
}

export function zonedDateParts(
  utcMs: number,
  timeZoneOffset: string,
): { isoDate: string; minutes: number } {
  const offsetMinutes = parseFixedOffsetMinutes(timeZoneOffset);
  const zonedMs = utcMs + offsetMinutes * 60_000;
  const zoned = new Date(zonedMs);
  const isoDate = `${zoned.getUTCFullYear()}-${String(zoned.getUTCMonth() + 1).padStart(2, '0')}-${String(zoned.getUTCDate()).padStart(2, '0')}`;
  const minutes = zoned.getUTCHours() * 60 + zoned.getUTCMinutes();

  return { isoDate, minutes };
}

function addOneDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));

  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function parseFixedOffsetMinutes(offset: string): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);

  if (!match) {
    return 0;
  }

  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function mergeIntervals(intervals: TimelineInterval[]): TimelineInterval[] {
  if (intervals.length === 0) {
    return [];
  }

  const merged: TimelineInterval[] = [{ ...intervals[0] }];

  for (let index = 1; index < intervals.length; index += 1) {
    const current = intervals[index];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}
