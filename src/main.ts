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
    state.currentDay = days[0] ?? '';

    if (!state.currentDay) {
      showLoading(elements.schedule, 'No festival days are configured.');
      return;
    }

    renderDayTabs(days);
    await loadSchedule(state.currentDay);
  } catch (error) {
    showError(elements.schedule, error);
  }
}

async function selectDay(day: string, days: string[]): Promise<void> {
  state.currentDay = day;
  renderDayTabs(days);
  await loadSchedule(day);
}

async function loadSchedule(day: string): Promise<void> {
  showLoading(elements.schedule);

  try {
    const rows = await api.getSchedule(day);
    state.schedule = sortByScheduleTime(
      normalizeScheduleRows(rows),
      config.preDawnCutoffMinutes,
    );

    populateFilterOptions(elements, allAttendees(state.schedule), allStages(state.schedule));
    renderCurrentSchedule();
  } catch (error) {
    showError(elements.schedule, error);
  }
}

function renderCurrentSchedule(): void {
  state.nickname = readNickname(elements);

  renderSchedule({
    container: elements.schedule,
    items: state.schedule,
    filters: readFilters(elements),
    overlapIds: computeOverlaps(state.schedule, state.nickname),
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

    state.schedule = sortByScheduleTime(
      normalizeScheduleRows(rows),
      config.preDawnCutoffMinutes,
    );
    populateFilterOptions(elements, allAttendees(state.schedule), allStages(state.schedule));
    renderCurrentSchedule();
  } catch (error) {
    showError(elements.schedule, error);
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function renderDayTabs(days: string[]): void {
  renderTabs(
    elements.tabs,
    days,
    state.currentDay,
    (day) => {
      void selectDay(day, days);
    },
    { datesByDay: calendarIsoDateMapForDays(days, config.dayToDate) },
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
    menuToggle: getRequiredElement('menu-toggle', HTMLButtonElement),
    controlsPanel,
    tabs: getRequiredElement('tabs', HTMLElement),
    schedule: getRequiredElement('schedule', HTMLElement),
  };
}
