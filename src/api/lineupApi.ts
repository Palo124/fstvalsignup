import type { RawScheduleRow } from '../types/schedule';

export interface LineupApi {
  listDays(): Promise<string[]>;
  getSchedule(day: string): Promise<RawScheduleRow[]>;
  toggleAttendance(input: ToggleAttendanceInput): Promise<RawScheduleRow[]>;
}

export interface ToggleAttendanceInput {
  day: string;
  rowIndex: number;
  nickname: string;
}

export function createLineupApi(baseUrl: string): LineupApi {
  return {
    listDays: () => request<string[]>(baseUrl, { action: 'listDays' }),
    getSchedule: (day) => request<RawScheduleRow[]>(baseUrl, { day }),
    toggleAttendance: ({ day, rowIndex, nickname }) =>
      request<RawScheduleRow[]>(baseUrl, {
        action: 'toggle',
        day,
        rowIndex: String(rowIndex),
        nickname,
      }),
  };
}

async function request<T>(baseUrl: string, params: Record<string, string>): Promise<T> {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set('nocache', String(Date.now()));

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Lineup API failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
