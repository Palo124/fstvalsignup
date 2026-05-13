/**
 * Resolves ISO calendar dates (YYYY-MM-DD) from festival "day" strings produced by the sheet / API.
 * Primary: European D.M.YYYY embedded in the label (spacing-tolerant).
 * Fallback: optional legacy map for labels that omit the year.
 */

const DM_YYYY = /(\d{1,2})\.\s*(\d{1,2})\.\s*((?:19|20)\d{2})\b/;

function toIsoDate(d: number, m: number, y: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return undefined;
  }

  const date = new Date(Date.UTC(y, m - 1, d));

  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return undefined;
  }

  const ys = String(y).padStart(4, '0');
  const ms = String(m).padStart(2, '0');
  const ds = String(d).padStart(2, '0');
  return `${ys}-${ms}-${ds}`;
}

/** First D.M.YYYY in the label → `YYYY-MM-DD`, or undefined if none / invalid. */
export function parseDayLabelToIsoDate(dayLabel: string): string | undefined {
  const match = DM_YYYY.exec(dayLabel.trim());

  if (!match) {
    return undefined;
  }

  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);

  return toIsoDate(d, m, y);
}

export function calendarIsoDateForDayLabel(
  dayLabel: string,
  legacyDayToDate?: Record<string, string>,
): string | undefined {
  return parseDayLabelToIsoDate(dayLabel) ?? legacyDayToDate?.[dayLabel];
}

export function calendarIsoDateMapForDays(
  days: string[],
  legacyDayToDate?: Record<string, string>,
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const day of days) {
    const iso = calendarIsoDateForDayLabel(day, legacyDayToDate);
    if (iso) {
      map[day] = iso;
    }
  }

  return map;
}
