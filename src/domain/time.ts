import type { TimeRange } from '../types/schedule';

const timeRangePattern = /^\s*(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*$/;

export function parseTimeRange(value: string): TimeRange | null {
  const match = timeRangePattern.exec(value);

  if (!match) return null;

  const [, startHour, startMinute, endHour, endMinute] = match.map(Number);

  if (
    !isValidClock(startHour, startMinute) ||
    !isValidClock(endHour, endMinute)
  ) {
    return null;
  }

  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return {
    label: value.trim(),
    startMinutes,
    endMinutes,
  };
}

export function sortStartMinutes(range: TimeRange, preDawnCutoffMinutes: number): number {
  return range.startMinutes < preDawnCutoffMinutes
    ? range.startMinutes + 24 * 60
    : range.startMinutes;
}

export function intervalDates(
  dayDate: string,
  range: TimeRange,
  timeZoneOffset: string,
  preDawnCutoffMinutes: number,
): { start: Date; end: Date } {
  const base = new Date(`${dayDate}T00:00:00${timeZoneOffset}`);
  const start = withMinutes(base, range.startMinutes);
  const end = withMinutes(base, range.endMinutes);

  if (range.startMinutes < preDawnCutoffMinutes) {
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

export function progressRemaining(start: Date, end: Date, nowMs: number): number {
  const duration = end.getTime() - start.getTime();

  if (duration <= 0) return 0;

  const remaining = ((end.getTime() - nowMs) / duration) * 100;
  return Math.min(100, Math.max(0, remaining));
}

function withMinutes(base: Date, minutes: number): Date {
  const date = new Date(base);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function isValidClock(hour: number, minute: number): boolean {
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
}
