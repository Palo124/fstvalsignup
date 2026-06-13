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
