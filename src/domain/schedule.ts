import { parseTimeRange, sortStartMinutes } from './time';
import type { RawScheduleRow, ScheduleItem } from '../types/schedule';

export function normalizeScheduleRows(rows: RawScheduleRow[]): ScheduleItem[] {
  return rows.flatMap((row) => {
    const id = toNumber(row.rowIndex);
    const artist = toNonEmptyString(row.Artist);
    const stage = toNonEmptyString(row.Stage);
    const timeLabel = toNonEmptyString(row.Time);

    if (id === null || artist === null || stage === null || timeLabel === null) {
      return [];
    }

    const time = parseTimeRange(timeLabel);
    if (!time) return [];

    const color = toOptionalString(row.Color);

    return [
      {
        id,
        artist,
        stage,
        time,
        attendees: splitAttendees(row.Attendees),
        ...(color ? { color } : {}),
      },
    ];
  });
}

export function sortByScheduleTime(items: ScheduleItem[], preDawnCutoffMinutes: number): ScheduleItem[] {
  return [...items].sort(
    (left, right) =>
      sortStartMinutes(left.time, preDawnCutoffMinutes) -
      sortStartMinutes(right.time, preDawnCutoffMinutes),
  );
}

export function allAttendees(items: ScheduleItem[]): string[] {
  return [...new Set(items.flatMap((item) => item.attendees))].sort();
}

export function allStages(items: ScheduleItem[]): string[] {
  return [...new Set(items.map((item) => item.stage).filter(Boolean))].sort();
}

function splitAttendees(value: unknown): string[] {
  if (typeof value !== 'string') return [];

  return value
    .split(',')
    .map((attendee) => attendee.trim())
    .filter(Boolean);
}

function toNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numberValue) ? numberValue : null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
