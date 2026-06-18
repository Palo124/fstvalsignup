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
  readMyScheduleFilters,
  readNickname,
  readPinNowPlaying,
  readShowDaySummary,
  type ControlsElements,
} from './ui/controls';
import { getRequiredElement } from './ui/dom';
import { hideDaySummary, renderDaySummary } from './ui/daySummaryView';
import { exitMyScheduleFullscreenIfActive, renderMySchedule } from './ui/myScheduleView';
import { renderSchedule, showError, showLoading } from './ui/scheduleView';
import { renderTabs } from './ui/tabs';
import type { AppView } from './ui/viewTabs';
import { initFooterSlogan } from './ui/footerSlogan';
import { initStickyNav } from './ui/stickyNav';
import { applyTheme, bindSystemTheme } from './ui/theme';
import { pollPendingNotifications, registerServiceWorker, syncPushSubscription } from './push/notifications';
import { loadJson, storageKeys } from './state/storage';
import type { ScheduleItem } from './types/schedule';

const api = createLineupApi(config.backendUrl);
initFooterSlogan();
initStickyNav();
const elements = getElements();
const initialControls = initControls(elements, renderCurrentView, applyTheme);
const state = createAppState(initialControls.nickname);
let currentView: AppView = 'lineup';
let focusLineupItemId: number | null = null;
const pendingToggleIds = new Set<number>();

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
    renderCurrentView();
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
    renderCurrentView();
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
  renderCurrentView();
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

function renderCurrentView(): void {
  state.nickname = readNickname(elements);
  const showDaySummary = readShowDaySummary(elements);
  const overlaps = computeOverlaps(state.schedule, state.nickname, config.preDawnCutoffMinutes);

  if (!showDaySummary || state.schedule.length === 0) {
    hideDaySummary(elements.daySummaryBar);
  }

  if (currentView === 'my-schedule') {
    if (showDaySummary) {
      renderDaySummary({
        container: elements.daySummaryBar,
        items: state.schedule,
        filters: readMyScheduleFilters(elements),
        overlaps,
        currentUser: state.nickname,
      });
    }

    renderMySchedule({
      container: elements.schedule,
      items: state.schedule,
      filters: readMyScheduleFilters(elements),
      overlaps,
      currentUser: state.nickname,
      dayKey: state.currentDay,
      dayDate: calendarIsoDateForDayLabel(state.currentDay, config.dayToDate),
      timeZoneOffset: config.festivalTimeZoneOffset,
      preDawnCutoffMinutes: config.preDawnCutoffMinutes,
      nowMs: Date.now(),
      onSelectItem: navigateToLineupItem,
    });
    return;
  }

  const focusItemId = focusLineupItemId;
  focusLineupItemId = null;

  if (showDaySummary) {
    renderDaySummary({
      container: elements.daySummaryBar,
      items: state.schedule,
      filters: readFilters(elements),
      overlaps,
      currentUser: state.nickname,
    });
  }

  renderSchedule({
    container: elements.schedule,
    items: state.schedule,
    filters: readFilters(elements),
    overlaps,
    currentUser: state.nickname,
    dayDate: calendarIsoDateForDayLabel(state.currentDay, config.dayToDate),
    timeZoneOffset: config.festivalTimeZoneOffset,
    preDawnCutoffMinutes: config.preDawnCutoffMinutes,
    pinNowPlaying: readPinNowPlaying(elements),
    dimPastShows: readDimPastShows(elements),
    nowMs: Date.now(),
    onToggle: toggleAttendance,
    pendingToggleIds,
    focusItemId,
  });
}

function navigateToLineupItem(item: ScheduleItem): void {
  focusLineupItemId = item.id;

  if (currentView !== 'lineup') {
    currentView = 'lineup';
    renderDayTabs();
  }

  renderCurrentView();
}

function selectView(view: AppView): void {
  if (view !== 'my-schedule') {
    exitMyScheduleFullscreenIfActive();
  }

  currentView = view;
  renderDayTabs();
  renderCurrentView();
}

async function toggleAttendance(item: ScheduleItem, _event: MouseEvent): Promise<void> {
  state.nickname = readNickname(elements);

  if (!state.nickname) {
    alert('Enter your nickname first in menu -> Your nickname');
    return;
  }

  if (pendingToggleIds.has(item.id)) {
    return;
  }

  const isAttending = item.attendees.includes(state.nickname);
  const optimisticAttendees = isAttending
    ? item.attendees.filter((attendee) => attendee !== state.nickname)
    : [...item.attendees, state.nickname];
  const previousSchedule = state.schedule;

  pendingToggleIds.add(item.id);
  state.schedule = state.schedule.map((show) =>
    show.id === item.id ? { ...show, attendees: optimisticAttendees } : show,
  );
  state.scheduleByDay.set(state.currentDay, state.schedule);
  renderCurrentView();

  try {
    const rows = await api.toggleAttendance({
      day: state.currentDay,
      rowIndex: item.id,
      nickname: state.nickname,
    });

    pendingToggleIds.delete(item.id);
    applyScheduleRows(state.currentDay, rows);
    if (loadJson(storageKeys.notificationsEnabled, false)) {
      void syncPushSubscription(state.nickname);
    }
  } catch (error) {
    pendingToggleIds.delete(item.id);
    state.schedule = previousSchedule;
    state.scheduleByDay.set(state.currentDay, previousSchedule);
    renderCurrentView();
    alert(error instanceof Error ? error.message : 'Could not update attendance.');
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
    {
      datesByDay: calendarIsoDateMapForDays(state.days, config.dayToDate),
      activeView: currentView,
      onSelectView: selectView,
    },
  );
}

function getElements(): ControlsElements & { tabs: HTMLElement; schedule: HTMLElement; daySummaryBar: HTMLElement } {
  return {
    nickname: getRequiredElement('nickname', HTMLInputElement),
    attendees: getRequiredElement('filterSelect', HTMLSelectElement),
    stages: getRequiredElement('stageSelect', HTMLSelectElement),
    theme: getRequiredElement('themeToggle', HTMLInputElement),
    overlapsOnly: getRequiredElement('collisionToggle', HTMLInputElement),
    joinedOnly: getRequiredElement('joinedToggle', HTMLInputElement),
    hasJoinersOnly: getRequiredElement('hasJoinersToggle', HTMLInputElement),
    popularOnly: getRequiredElement('popularToggle', HTMLInputElement),
    myScheduleJoinedOnly: getRequiredElement('myScheduleJoinedToggle', HTMLInputElement),
    pinNow: getRequiredElement('pinToggle', HTMLInputElement),
    dimPast: getRequiredElement('pastToggle', HTMLInputElement),
    daySummary: getRequiredElement('daySummaryToggle', HTMLInputElement),
    notifications: getRequiredElement('notificationsToggle', HTMLInputElement),
    notificationsHint: getRequiredElement('notifications-hint', HTMLElement),
    notificationSettings: getRequiredElement('notification-settings', HTMLElement),
    notificationSettingsHint: getRequiredElement('notification-settings-hint', HTMLElement),
    notifyStartsSoon: getRequiredElement('notifyStartsSoon', HTMLInputElement),
    notifyNowPlaying: getRequiredElement('notifyNowPlaying', HTMLInputElement),
    notifyDailyOpener: getRequiredElement('notifyDailyOpener', HTMLInputElement),
    menuToggle: getRequiredElement('menu-toggle', HTMLButtonElement),
    settingsClose: getRequiredElement('settings-close', HTMLButtonElement),
    settingsInfo: getRequiredElement('settings-info', HTMLButtonElement),
    infoClose: getRequiredElement('info-close', HTMLButtonElement),
    infoDialog: getRequiredElement('info-dialog', HTMLDialogElement),
    controlsPanel: getRequiredElement('controls', HTMLDialogElement),
    tabs: getRequiredElement('tabs', HTMLElement),
    schedule: getRequiredElement('schedule', HTMLElement),
    daySummaryBar: getRequiredElement('day-summary', HTMLElement),
  };
}
