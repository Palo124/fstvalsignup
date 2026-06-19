import { defaultNotificationPreferences } from '../domain/notifications';
import { loadJson, loadString, loadThemePreference, saveJson, saveString, storageKeys } from '../state/storage';
import type { ScheduleFilters } from '../types/schedule';
import type { ThemePreference } from '../state/storage';
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushSupported,
  loadNotificationPreferences,
  saveNotificationPreferences,
  syncPushSubscription,
} from '../push/notifications';

export interface ControlsElements {
  nickname: HTMLInputElement;
  attendees: HTMLSelectElement;
  stages: HTMLSelectElement;
  theme: HTMLInputElement;
  overlapsOnly: HTMLInputElement;
  joinedOnly: HTMLInputElement;
  hasJoinersOnly: HTMLInputElement;
  popularOnly: HTMLInputElement;
  myScheduleJoinedOnly: HTMLInputElement;
  pinNow: HTMLInputElement;
  dimPast: HTMLInputElement;
  daySummary: HTMLInputElement;
  notifications: HTMLInputElement;
  notificationsHint: HTMLElement;
  notificationSettings: HTMLElement;
  notificationSettingsHint: HTMLElement;
  notifyStartsSoon: HTMLInputElement;
  notifyNowPlaying: HTMLInputElement;
  notifyDailyOpener: HTMLInputElement;
  menuToggle: HTMLButtonElement;
  settingsClose: HTMLButtonElement;
  settingsInfo: HTMLButtonElement;
  infoClose: HTMLButtonElement;
  infoDialog: HTMLDialogElement;
  controlsPanel: HTMLDialogElement;
}

export interface ControlState {
  nickname: string;
  themePreference: ThemePreference;
  pinNowPlaying: boolean;
  dimPastShows: boolean;
}

export function initControls(elements: ControlsElements, onChange: () => void, onThemeChange: (pref: ThemePreference) => void): ControlState {
  const nickname = loadString(storageKeys.nickname);
  const themePreference = loadThemePreference();

  elements.nickname.value = nickname;
  elements.theme.checked = themePreference === 'dark';
  elements.overlapsOnly.checked = loadJson(storageKeys.filterOverlaps, false);
  elements.joinedOnly.checked = loadJson(storageKeys.filterJoined, false);
  elements.hasJoinersOnly.checked = loadJson(storageKeys.filterHasJoiners, false);
  elements.popularOnly.checked = loadJson(storageKeys.filterPopular, false);
  elements.myScheduleJoinedOnly.checked = loadJson(storageKeys.myScheduleJoinedOnly, true);
  elements.pinNow.checked = loadJson(storageKeys.pinNowPlaying, false);
  elements.dimPast.checked = loadJson(storageKeys.dimPastShows, true);
  elements.daySummary.checked = loadJson(storageKeys.showDaySummary, false);
  elements.notifications.checked = loadJson(storageKeys.notificationsEnabled, false);
  applyNotificationPreferencesToUi(elements);
  configureNotificationsUi(elements);

  elements.nickname.addEventListener('input', () => {
    saveString(storageKeys.nickname, elements.nickname.value.trim());
    onChange();
  });

  elements.attendees.addEventListener('change', () => {
    saveJson(storageKeys.filterAttendees, selectedValues(elements.attendees));
    onChange();
  });

  elements.stages.addEventListener('change', () => {
    saveJson(storageKeys.filterStages, selectedValues(elements.stages));
    onChange();
  });

  elements.overlapsOnly.addEventListener('change', () => {
    saveJson(storageKeys.filterOverlaps, elements.overlapsOnly.checked);
    onChange();
  });

  elements.joinedOnly.addEventListener('change', () => {
    saveJson(storageKeys.filterJoined, elements.joinedOnly.checked);
    onChange();
  });

  elements.hasJoinersOnly.addEventListener('change', () => {
    saveJson(storageKeys.filterHasJoiners, elements.hasJoinersOnly.checked);
    onChange();
  });

  elements.popularOnly.addEventListener('change', () => {
    saveJson(storageKeys.filterPopular, elements.popularOnly.checked);
    onChange();
  });

  elements.myScheduleJoinedOnly.addEventListener('change', () => {
    saveJson(storageKeys.myScheduleJoinedOnly, elements.myScheduleJoinedOnly.checked);
    onChange();
  });

  elements.pinNow.addEventListener('change', () => {
    saveJson(storageKeys.pinNowPlaying, elements.pinNow.checked);
    onChange();
  });

  elements.dimPast.addEventListener('change', () => {
    saveJson(storageKeys.dimPastShows, elements.dimPast.checked);
    onChange();
  });

  elements.daySummary.addEventListener('change', () => {
    saveJson(storageKeys.showDaySummary, elements.daySummary.checked);
    onChange();
  });

  elements.theme.addEventListener('change', () => {
    const pref: ThemePreference = elements.theme.checked ? 'dark' : 'auto';
    saveString(storageKeys.themePref, pref);
    onThemeChange(pref);
  });

  elements.notifications.addEventListener('change', () => {
    void handleNotificationsToggle(elements, onChange);
  });

  for (const input of [elements.notifyStartsSoon, elements.notifyNowPlaying, elements.notifyDailyOpener]) {
    input.addEventListener('change', () => {
      void handleNotificationPreferenceChange(elements);
    });
  }

  elements.menuToggle.addEventListener('click', () => {
    if (elements.controlsPanel.open) {
      elements.controlsPanel.close();
    } else {
      openSettingsDialog(elements);
    }
  });

  elements.settingsClose.addEventListener('click', () => {
    elements.controlsPanel.close();
  });

  elements.settingsInfo.addEventListener('click', () => {
    elements.infoDialog.showModal();
  });

  elements.infoClose.addEventListener('click', () => {
    elements.infoDialog.close();
  });

  elements.controlsPanel.addEventListener('close', () => {
    unlockBodyScroll();
    syncSettingsDialogAria(elements);
  });

  return {
    nickname,
    themePreference,
    pinNowPlaying: elements.pinNow.checked,
    dimPastShows: elements.dimPast.checked,
  };
}

export function populateFilterOptions(elements: ControlsElements, attendees: string[], stages: string[]): void {
  fillSelect(elements.attendees, attendees, storageKeys.filterAttendees);
  fillSelect(elements.stages, stages, storageKeys.filterStages);
}

export function readFilters(elements: ControlsElements): ScheduleFilters {
  const filters = {
    attendees: selectedValues(elements.attendees),
    stages: selectedValues(elements.stages),
    overlapsOnly: elements.overlapsOnly.checked,
    joinedOnly: elements.joinedOnly.checked,
    hasJoinersOnly: elements.hasJoinersOnly.checked,
    popularOnly: elements.popularOnly.checked,
    query: '',
  };

  saveJson(storageKeys.filterAttendees, filters.attendees);
  saveJson(storageKeys.filterStages, filters.stages);
  saveJson(storageKeys.filterOverlaps, filters.overlapsOnly);
  saveJson(storageKeys.filterJoined, filters.joinedOnly);
  saveJson(storageKeys.filterHasJoiners, filters.hasJoinersOnly);
  saveJson(storageKeys.filterPopular, filters.popularOnly);

  return filters;
}

export function readMyScheduleFilters(elements: ControlsElements): ScheduleFilters {
  return {
    ...readFilters(elements),
    joinedOnly: readMyScheduleJoinedOnly(elements),
    popularOnly: false,
  };
}

export function readMyScheduleJoinedOnly(elements: ControlsElements): boolean {
  saveJson(storageKeys.myScheduleJoinedOnly, elements.myScheduleJoinedOnly.checked);
  return elements.myScheduleJoinedOnly.checked;
}

export function readNickname(elements: ControlsElements): string {
  return elements.nickname.value.trim();
}

export function readPinNowPlaying(elements: ControlsElements): boolean {
  saveJson(storageKeys.pinNowPlaying, elements.pinNow.checked);
  return elements.pinNow.checked;
}

export function readDimPastShows(elements: ControlsElements): boolean {
  saveJson(storageKeys.dimPastShows, elements.dimPast.checked);
  return elements.dimPast.checked;
}

export function readShowDaySummary(elements: ControlsElements): boolean {
  saveJson(storageKeys.showDaySummary, elements.daySummary.checked);
  return elements.daySummary.checked;
}

function fillSelect(select: HTMLSelectElement, values: string[], storageKey: string): void {
  const selected = new Set(loadJson<string[]>(storageKey, []));

  select.replaceChildren(
    ...values.map((value) => {
      const option = new Option(value, value, false, selected.has(value));
      return option;
    }),
  );
}

function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function syncSettingsDialogAria(elements: ControlsElements): void {
  elements.menuToggle.setAttribute('aria-expanded', String(elements.controlsPanel.open));
}

let savedScrollY = 0;

function openSettingsDialog(elements: ControlsElements): void {
  savedScrollY = window.scrollY;
  document.body.classList.add('settings-open');
  document.body.style.top = `-${savedScrollY}px`;
  elements.controlsPanel.showModal();
  syncSettingsDialogAria(elements);
}

function unlockBodyScroll(): void {
  document.body.classList.remove('settings-open');
  document.body.style.removeProperty('top');
  window.scrollTo(0, savedScrollY);
}

function applyNotificationPreferencesToUi(elements: ControlsElements): void {
  const preferences = loadNotificationPreferences();
  elements.notifyStartsSoon.checked = preferences.startsSoon;
  elements.notifyNowPlaying.checked = preferences.nowPlaying;
  elements.notifyDailyOpener.checked = preferences.dailyOpener;
  updateNotificationDetailLabels(elements, preferences);
}

function updateNotificationDetailLabels(
  elements: ControlsElements,
  preferences = loadNotificationPreferences(),
): void {
  const startsSoonLabel = elements.notifyStartsSoon
    .closest('.notification-pref')
    ?.querySelector('.switch-detail');
  const dailyOpenerLabel = elements.notifyDailyOpener
    .closest('.notification-pref')
    ?.querySelector('.switch-detail');

  if (startsSoonLabel) {
    startsSoonLabel.textContent = `${preferences.startsSoonLeadMinutes} min before`;
  }
  if (dailyOpenerLabel) {
    const hour = String(preferences.dailyOpenerHour).padStart(2, '0');
    dailyOpenerLabel.textContent = `${hour}:00 summary`;
  }
}

function readNotificationPreferencesFromUi(elements: ControlsElements) {
  const current = loadNotificationPreferences();
  return {
    ...current,
    startsSoon: elements.notifyStartsSoon.checked,
    nowPlaying: elements.notifyNowPlaying.checked,
    dailyOpener: elements.notifyDailyOpener.checked,
  };
}

function configureNotificationsUi(elements: ControlsElements): void {
  const supported = isPushSupported();
  elements.notifications.disabled = !supported;
  elements.notificationsHint.hidden = supported;

  if (!supported) {
    elements.notifications.checked = false;
    elements.notificationSettings.hidden = true;
    return;
  }

  const enabled = elements.notifications.checked;
  elements.notificationSettings.hidden = false;
  elements.notificationSettings.classList.toggle('is-disabled', !enabled);
  elements.notificationSettingsHint.hidden = enabled;
}

async function handleNotificationPreferenceChange(elements: ControlsElements): Promise<void> {
  const preferences = readNotificationPreferencesFromUi(elements);
  saveNotificationPreferences(preferences);
  updateNotificationDetailLabels(elements, preferences);

  if (!elements.notifications.checked) {
    return;
  }

  try {
    await syncPushSubscription(elements.nickname.value.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save notification settings.';
    alert(message);
    applyNotificationPreferencesToUi(elements);
  }
}

async function handleNotificationsToggle(elements: ControlsElements, onChange: () => void): Promise<void> {
  const nickname = elements.nickname.value.trim();

  if (elements.notifications.checked) {
    try {
      await enablePushNotifications(nickname);
    } catch (error) {
      elements.notifications.checked = false;
      saveJson(storageKeys.notificationsEnabled, false);
      configureNotificationsUi(elements);
      const message = error instanceof Error ? error.message : 'Could not enable notifications.';
      alert(message);
      return;
    }
  } else {
    try {
      await disablePushNotifications();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not disable notifications.';
      alert(message);
      elements.notifications.checked = true;
      configureNotificationsUi(elements);
      return;
    }
  }

  configureNotificationsUi(elements);
  onChange();
}
