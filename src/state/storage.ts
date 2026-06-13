export type ThemePreference = 'auto' | 'dark';

export const storageKeys = {
  nickname: 'nickname',
  themePref: 'themePref',
  filterAttendees: 'filterAttendees',
  filterStages: 'filterStages',
  dimPastShows: 'dimPastShows',
  filterOverlaps: 'filterOverlaps',
  pinNowPlaying: 'pinNowPlaying',
  notificationsEnabled: 'notificationsEnabled',
  notificationPrefs: 'notificationPrefs',
} as const;

export function loadString(key: string, fallback = ''): string {
  return localStorage.getItem(key) ?? fallback;
}

export function saveString(key: string, value: string): void {
  localStorage.setItem(key, value);
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadThemePreference(): ThemePreference {
  return loadString(storageKeys.themePref, 'auto') === 'dark' ? 'dark' : 'auto';
}
