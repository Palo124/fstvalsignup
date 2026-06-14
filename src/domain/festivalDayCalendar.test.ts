import { describe, expect, it } from 'vitest';
import {
  activeFestivalDays,
  calendarIsoDateForDayLabel,
  calendarIsoDateMapForDays,
  formatDayTabLabel,
  parseDayLabelToIsoDate,
} from './festivalDayCalendar';

describe('parseDayLabelToIsoDate', () => {
  it('parses D.M. YYYY with weekday suffix', () => {
    expect(parseDayLabelToIsoDate('1.7. 2026 Wednesday')).toBe('2026-07-01');
  });

  it('parses D.M.YYYY without space before year', () => {
    expect(parseDayLabelToIsoDate('4.7.2026 Saturday')).toBe('2026-07-04');
  });

  it('parses single-digit month/day with spaces', () => {
    expect(parseDayLabelToIsoDate('2.7. 2025 Thursday')).toBe('2025-07-02');
  });

  it('parses Czech-style D. M. YYYY with leading text', () => {
    expect(parseDayLabelToIsoDate('Středa 1. 7. 2026')).toBe('2026-07-01');
  });

  it('returns undefined for invalid calendar date', () => {
    expect(parseDayLabelToIsoDate('31.2. 2026 Saturday')).toBeUndefined();
  });

  it('returns undefined when no date in label', () => {
    expect(parseDayLabelToIsoDate('Středa 1. 7.')).toBeUndefined();
  });
});

describe('calendarIsoDateForDayLabel', () => {
  it('uses legacy map when label has no parseable year', () => {
    expect(
      calendarIsoDateForDayLabel('Streda 2.7.', {
        'Streda 2.7.': '2025-07-02',
      }),
    ).toBe('2025-07-02');
  });

  it('prefers embedded D.M.YYYY over legacy', () => {
    expect(
      calendarIsoDateForDayLabel('1.7. 2026 Wednesday', {
        '1.7. 2026 Wednesday': '2099-01-01',
      }),
    ).toBe('2026-07-01');
  });
});

describe('activeFestivalDays', () => {
  it('drops tabs whose names contain OLD', () => {
    expect(
      activeFestivalDays(['Thursday 1.7. 2026', 'Friday OLD', 'Saturday 2.7. 2026']),
    ).toEqual(['Thursday 1.7. 2026', 'Saturday 2.7. 2026']);
  });
});

describe('formatDayTabLabel', () => {
  it('removes OLD from displayed tab labels', () => {
    expect(formatDayTabLabel('Friday OLD 2.7. 2026')).toBe('Friday 2.7. 2026');
  });
});

describe('calendarIsoDateMapForDays', () => {
  it('builds a map for mixed labels', () => {
    expect(
      calendarIsoDateMapForDays(['1.7. 2026 Wednesday', 'Streda 2.7.'], {
        'Streda 2.7.': '2025-07-02',
      }),
    ).toEqual({
      '1.7. 2026 Wednesday': '2026-07-01',
      'Streda 2.7.': '2025-07-02',
    });
  });
});
