import { describe, expect, it } from 'vitest';
import { normalizeScheduleRows, sortByScheduleTime } from './schedule';

describe('normalizeScheduleRows', () => {
  it('normalizes raw Apps Script rows', () => {
    expect(
      normalizeScheduleRows([
        {
          rowIndex: '12',
          Artist: '  Artist  ',
          Stage: 'Main',
          Time: '22:00–23:00',
          Attendees: 'Ada, Grace',
        },
      ]),
    ).toEqual([
      {
        id: 12,
        artist: 'Artist',
        stage: 'Main',
        time: {
          label: '22:00–23:00',
          startMinutes: 1320,
          endMinutes: 1380,
        },
        attendees: ['Ada', 'Grace'],
      },
    ]);
  });

  it('drops invalid rows at the API boundary', () => {
    expect(normalizeScheduleRows([{ Artist: 'No time', Stage: 'Main' }])).toEqual([]);
  });
});

describe('sortByScheduleTime', () => {
  it('sorts pre-dawn rows after evening rows', () => {
    const [late, early] = normalizeScheduleRows([
      { rowIndex: 1, Artist: 'Late', Stage: 'Main', Time: '02:00–03:00' },
      { rowIndex: 2, Artist: 'Evening', Stage: 'Main', Time: '22:00–23:00' },
    ]);

    expect(sortByScheduleTime([late, early], 300).map((item) => item.artist)).toEqual(['Evening', 'Late']);
  });

  it('sorts morning afterparty rows after the main day', () => {
    const items = normalizeScheduleRows([
      { rowIndex: 1, Artist: 'Afterparty', Stage: 'FABRIC AFTERPARTY MAIN', Time: '10:00–11:00' },
      { rowIndex: 2, Artist: 'Opener', Stage: 'LOVE', Time: '14:00–15:00' },
      { rowIndex: 3, Artist: 'Night', Stage: 'EMPIRE', Time: '02:00–03:00' },
    ]);

    expect(sortByScheduleTime(items, 11 * 60).map((item) => item.artist)).toEqual([
      'Opener',
      'Night',
      'Afterparty',
    ]);
  });
});
