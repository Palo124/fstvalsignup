import './styles.css';
import { createLineupApi } from './api/lineupApi';
import { config } from './config';
import { calendarIsoDateForDayLabel, calendarIsoDateMapForDays } from './domain/festivalDayCalendar';
import { allAttendees, allStages, normalizeScheduleRows, sortByScheduleTime } from './domain/schedule';
import { computeOverlaps } from './domain/overlaps';
import { createAppState } from './state/appState';
import {
  initControls,
  populateFilterOptions,
  readDimPastShows,
  readFilters,
  readNickname,
  readPinNowPlaying,
  type ControlsElements,
} from './ui/controls';
import { getRequiredElement } from './ui/dom';
import { renderSchedule, showError, showLoading } from './ui/scheduleView';
import { renderTabs } from './ui/tabs';
import { applyTheme, bindSystemTheme } from './ui/theme';
import { pollPendingNotifications, registerServiceWorker, syncPushSubscription } from './push/notifications';
import { loadJson, storageKeys } from './state/storage';
import type { ScheduleItem } from './types/schedule';

const api = createLineupApi(config.backendUrl);
const elements = getElements();
const initialControls = initControls(elements, renderCurrentSchedule, applyTheme);
const state = createAppState(initialControls.nickname);

applyTheme(initialControls.themePreference);
bindSystemTheme(() => {
  if (!elements.theme.checked) {
    applyTheme('auto');
  }
});

void registerServiceWorker();

if (loadJson(storageKeys.notificationsEnabled, false)) {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void pollPendingNotifications();
  });
  setInterval(() => {
    if (!document.hidden) void pollPendingNotifications();
  }, 60_000);
  void pollPendingNotifications();
}

void bootstrap();

setInterval(() => {
  if (!document.hidden && state.schedule.length > 0) {
    renderCurrentSchedule();
  }
}, 30_000);

async function bootstrap(): Promise<void> {
  showLoading(elements.schedule);

  try {
    const days = await api.listDays();
    state.days = days;
    state.currentDay = days[0] ?? '';

    if (!state.currentDay) {
      showLoading(elements.schedule, 'No festival days are configured.');
      return;
    }

    renderDayTabs();
    await loadSchedule(state.currentDay);
    prefetchSchedules(days, state.currentDay);
  } catch (error) {
    showError(elements.schedule, error);
  }
}

async function selectDay(day: string): Promise<void> {
  state.currentDay = day;
  renderDayTabs();
  await loadSchedule(day);
}

async function loadSchedule(day: string): Promise<void> {
  const cached = state.scheduleByDay.get(day);
  if (cached) {
    state.schedule = cached;
    renderCurrentSchedule();
  } else {
    showLoading(elements.schedule);
  }

  try {
    const rows = await api.getSchedule(day);
    applyScheduleRows(day, rows);
  } catch (error) {
    if (!cached) {
      showError(elements.schedule, error);
    }
  }
}

function applyScheduleRows(day: string, rows: Parameters<typeof normalizeScheduleRows>[0]): void {
  const schedule = sortByScheduleTime(
    normalizeScheduleRows(rows),
    config.preDawnCutoffMinutes,
  );

  state.schedule = schedule;
  state.scheduleByDay.set(day, schedule);
  populateFilterOptions(elements, allAttendees(schedule), allStages(schedule));
  renderCurrentSchedule();
  void syncPushSubscription(readNickname(elements));
}

function prefetchSchedules(days: string[], activeDay: string): void {
  for (const day of days) {
    if (day === activeDay || state.scheduleByDay.has(day)) {
      continue;
    }

    void api.getSchedule(day).then((rows) => {
      if (state.scheduleByDay.has(day)) {
        return;
      }

      const schedule = sortByScheduleTime(
        normalizeScheduleRows(rows),
        config.preDawnCutoffMinutes,
      );
      state.scheduleByDay.set(day, schedule);
    });
  }
}

function renderCurrentSchedule(): void {
  state.nickname = readNickname(elements);

  renderSchedule({
    container: elements.schedule,
    items: state.schedule,
    filters: readFilters(elements),
    overlaps: computeOverlaps(state.schedule, state.nickname, config.preDawnCutoffMinutes),
    currentUser: state.nickname,
    dayDate: calendarIsoDateForDayLabel(state.currentDay, config.dayToDate),
    timeZoneOffset: config.festivalTimeZoneOffset,
    preDawnCutoffMinutes: config.preDawnCutoffMinutes,
    pinNowPlaying: readPinNowPlaying(elements),
    dimPastShows: readDimPastShows(elements),
    nowMs: Date.now(),
    onToggle: toggleAttendance,
  });
}

async function toggleAttendance(item: ScheduleItem, event: MouseEvent): Promise<void> {
  state.nickname = readNickname(elements);

  if (!state.nickname) {
    alert('Enter your nickname first in menu -> Your nickname');
    return;
  }

  const button = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  const originalText = button?.textContent ?? '';
  const isAttending = item.attendees.includes(state.nickname);
  const optimisticAttendees = isAttending
    ? item.attendees.filter((attendee) => attendee !== state.nickname)
    : [...item.attendees, state.nickname];
  const previousSchedule = state.schedule;

  state.schedule = state.schedule.map((show) =>
    show.id === item.id ? { ...show, attendees: optimisticAttendees } : show,
  );
  state.scheduleByDay.set(state.currentDay, state.schedule);
  renderCurrentSchedule();

  if (button) {
    button.disabled = true;
    button.textContent = 'Working...';
  }

  try {
    const rows = await api.toggleAttendance({
      day: state.currentDay,
      rowIndex: item.id,
      nickname: state.nickname,
    });

    applyScheduleRows(state.currentDay, rows);
    if (loadJson(storageKeys.notificationsEnabled, false)) {
      void syncPushSubscription(state.nickname);
    }
  } catch (error) {
    state.schedule = previousSchedule;
    state.scheduleByDay.set(state.currentDay, previousSchedule);
    renderCurrentSchedule();
    alert(error instanceof Error ? error.message : 'Could not update attendance.');
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function renderDayTabs(): void {
  renderTabs(
    elements.tabs,
    state.days,
    state.currentDay,
    (day) => {
      void selectDay(day);
    },
    { datesByDay: calendarIsoDateMapForDays(state.days, config.dayToDate) },
  );
}

function getElements(): ControlsElements & { tabs: HTMLElement; schedule: HTMLElement } {
  const controlsPanel = getRequiredElement('controls', HTMLElement);

  return {
    nickname: getRequiredElement('nickname', HTMLInputElement),
    attendees: getRequiredElement('filterSelect', HTMLSelectElement),
    stages: getRequiredElement('stageSelect', HTMLSelectElement),
    theme: getRequiredElement('themeToggle', HTMLInputElement),
    overlapsOnly: getRequiredElement('collisionToggle', HTMLInputElement),
    pinNow: getRequiredElement('pinToggle', HTMLInputElement),
    dimPast: getRequiredElement('pastToggle', HTMLInputElement),
    notifications: getRequiredElement('notificationsToggle', HTMLInputElement),
    notificationsHint: getRequiredElement('notifications-hint', HTMLElement),
    notificationSettings: getRequiredElement('notification-settings', HTMLElement),
    notificationSettingsHint: getRequiredElement('notification-settings-hint', HTMLElement),
    notifyStartsSoon: getRequiredElement('notifyStartsSoon', HTMLInputElement),
    notifyNowPlaying: getRequiredElement('notifyNowPlaying', HTMLInputElement),
    notifyDailyOpener: getRequiredElement('notifyDailyOpener', HTMLInputElement),
    menuToggle: getRequiredElement('menu-toggle', HTMLButtonElement),
    controlsPanel,
    tabs: getRequiredElement('tabs', HTMLElement),
    schedule: getRequiredElement('schedule', HTMLElement),
  };
}
