import { loadJson, loadString, loadThemePreference, saveJson, saveString, storageKeys } from '../state/storage';
import type { ScheduleFilters } from '../types/schedule';
import type { ThemePreference } from '../state/storage';
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushSupported,
} from '../push/notifications';

export interface ControlsElements {
  nickname: HTMLInputElement;
  attendees: HTMLSelectElement;
  stages: HTMLSelectElement;
  theme: HTMLInputElement;
  overlapsOnly: HTMLInputElement;
  pinNow: HTMLInputElement;
  dimPast: HTMLInputElement;
  notifications: HTMLInputElement;
  notificationsHint: HTMLElement;
  menuToggle: HTMLButtonElement;
  controlsPanel: HTMLElement;
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
  elements.pinNow.checked = loadJson(storageKeys.pinNowPlaying, false);
  elements.dimPast.checked = loadJson(storageKeys.dimPastShows, true);
  elements.notifications.checked = loadJson(storageKeys.notificationsEnabled, false);
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

  elements.pinNow.addEventListener('change', () => {
    saveJson(storageKeys.pinNowPlaying, elements.pinNow.checked);
    onChange();
  });

  elements.dimPast.addEventListener('change', () => {
    saveJson(storageKeys.dimPastShows, elements.dimPast.checked);
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

  elements.menuToggle.addEventListener('click', () => {
    const collapsed = elements.controlsPanel.classList.toggle('collapsed');
    elements.menuToggle.setAttribute('aria-expanded', String(!collapsed));
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
  };

  saveJson(storageKeys.filterAttendees, filters.attendees);
  saveJson(storageKeys.filterStages, filters.stages);
  saveJson(storageKeys.filterOverlaps, filters.overlapsOnly);

  return filters;
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

function configureNotificationsUi(elements: ControlsElements): void {
  const supported = isPushSupported();
  elements.notifications.disabled = !supported;
  elements.notificationsHint.hidden = supported;
  if (!supported) {
    elements.notifications.checked = false;
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
      return;
    }
  }

  onChange();
}
