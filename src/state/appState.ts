import type { ScheduleItem } from '../types/schedule';

export interface AppState {
  currentDay: string;
  nickname: string;
  schedule: ScheduleItem[];
}

export function createAppState(nickname: string): AppState {
  return {
    currentDay: '',
    nickname,
    schedule: [],
  };
}
