export type NotificationType = 'starts_soon' | 'daily_opener' | 'now_playing';

export interface NotificationPreferences {
  startsSoon: boolean;
  dailyOpener: boolean;
  nowPlaying: boolean;
  startsSoonLeadMinutes: number;
  dailyOpenerHour: number;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  startsSoon: true,
  dailyOpener: true,
  nowPlaying: true,
  startsSoonLeadMinutes: 15,
  dailyOpenerHour: 10,
};

export function normalizeNotificationPreferences(
  value: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  return {
    startsSoon: value?.startsSoon !== false,
    dailyOpener: value?.dailyOpener !== false,
    nowPlaying: value?.nowPlaying !== false,
    startsSoonLeadMinutes: Number(value?.startsSoonLeadMinutes) || defaultNotificationPreferences.startsSoonLeadMinutes,
    dailyOpenerHour: Number(value?.dailyOpenerHour) || defaultNotificationPreferences.dailyOpenerHour,
  };
}
