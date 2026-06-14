import type { ScheduleItem } from '../types/schedule';

export interface AppState {
  currentDay: string;
  nickname: string;
  schedule: ScheduleItem[];
  days: string[];
  scheduleByDay: Map<string, ScheduleItem[]>;
}

export function createAppState(nickname: string): AppState {
  return {
    currentDay: '',
    nickname,
    schedule: [],
    days: [],
    scheduleByDay: new Map(),
  };
}
