import { formatDayTabLabel } from '../domain/festivalDayCalendar';
import { clear } from './dom';
import { appendViewTabs, type AppView } from './viewTabs';

export interface RenderTabsOptions {
  /** ISO `YYYY-MM-DD` per day key; used when the day label has no year. */
  datesByDay?: Record<string, string>;
  activeView?: AppView;
  onSelectView?: (view: AppView) => void;
}

const PANEL_YEAR = 'panelYear';
const LAST_ACTIVE = 'lastRenderedActiveDay';

function yearForDay(day: string, datesByDay?: Record<string, string>): string | undefined {
  const iso = datesByDay?.[day];
  if (iso) {
    const y = iso.slice(0, 4);
    if (/^\d{4}$/.test(y)) {
      return y;
    }
  }
  const m = day.match(/\b(19|20)\d{2}\s*$/);
  return m ? m[0].trim() : undefined;
}

function yearKeyForDay(day: string, datesByDay?: Record<string, string>): string {
  return yearForDay(day, datesByDay) ?? '__other__';
}

function groupDaysByYear(days: string[], datesByDay?: Record<string, string>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const day of days) {
    const y = yearKeyForDay(day, datesByDay);
    if (!groups.has(y)) {
      groups.set(y, []);
    }
    groups.get(y)!.push(day);
  }
  return groups;
}

function sortedYearKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === '__other__') {
      return 1;
    }
    if (b === '__other__') {
      return -1;
    }
    return b.localeCompare(a);
  });
}

function yearLabel(yearKey: string): string {
  return yearKey === '__other__' ? 'Other' : yearKey;
}

function renderDayButtons(row: HTMLElement, days: string[], activeDay: string, onSelect: (day: string) => void): void {
  for (const day of days) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = formatDayTabLabel(day);
    button.dataset.day = day;
    button.className = 'day-tab';

    if (day === activeDay) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => onSelect(day));
    row.appendChild(button);
  }
}

function resolvePanelYear(
  container: HTMLElement,
  yearKeys: string[],
  activeDay: string,
  activeYearKey: string,
): string {
  const last = container.dataset[LAST_ACTIVE] ?? '';
  if (last !== activeDay) {
    container.dataset[LAST_ACTIVE] = activeDay;
    container.dataset[PANEL_YEAR] = activeYearKey;
    return activeYearKey;
  }

  let panel = container.dataset[PANEL_YEAR] ?? '';
  if (!yearKeys.includes(panel)) {
    panel = activeYearKey;
    container.dataset[PANEL_YEAR] = panel;
  }
  return panel;
}

function appendViewTabsIfNeeded(toolbar: HTMLElement, options?: RenderTabsOptions): void {
  if (options?.activeView && options.onSelectView) {
    appendViewTabs(toolbar, options.activeView, options.onSelectView);
  }
}

export function renderTabs(
  container: HTMLElement,
  days: string[],
  activeDay: string,
  onSelect: (day: string) => void,
  options?: RenderTabsOptions,
): void {
  clear(container);

  const datesByDay = options?.datesByDay;
  const groups = groupDaysByYear(days, datesByDay);
  const yearKeys = sortedYearKeys([...groups.keys()]);

  if (yearKeys.length <= 1) {
    container.classList.remove('tabs-grouped');
    delete container.dataset[PANEL_YEAR];
    delete container.dataset[LAST_ACTIVE];

    const toolbar = document.createElement('div');
    toolbar.className = 'tab-toolbar';

    const row = document.createElement('div');
    row.className = 'tab-row';
    const onlyDays = yearKeys.length === 0 ? days : groups.get(yearKeys[0]) ?? days;
    renderDayButtons(row, onlyDays, activeDay, onSelect);
    toolbar.appendChild(row);
    appendViewTabsIfNeeded(toolbar, options);
    container.appendChild(toolbar);
    return;
  }

  container.classList.add('tabs-grouped');

  const activeYearKey = days.includes(activeDay) ? yearKeyForDay(activeDay, datesByDay) : yearKeys[0];
  const panelYear = resolvePanelYear(container, yearKeys, activeDay, activeYearKey);
  container.dataset[PANEL_YEAR] = panelYear;

  const yearRow = document.createElement('div');
  yearRow.className = 'tab-year-strip';
  yearRow.setAttribute('role', 'tablist');
  yearRow.setAttribute('aria-label', 'Years');

  const toolbar = document.createElement('div');
  toolbar.className = 'tab-toolbar tab-toolbar--years';

  const dayPanel = document.createElement('div');
  dayPanel.className = 'tab-day-panel';
  dayPanel.setAttribute('role', 'tabpanel');

  for (const yearKey of yearKeys) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'year-tab';
    tab.textContent = yearLabel(yearKey);
    tab.dataset.year = yearKey;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', yearKey === panelYear ? 'true' : 'false');
    if (yearKey === panelYear) {
      tab.classList.add('active');
    }
    tab.addEventListener('click', () => {
      container.dataset[PANEL_YEAR] = yearKey;
      renderTabs(container, days, activeDay, onSelect, options);
    });
    yearRow.appendChild(tab);
  }

  const visibleDays = groups.get(panelYear) ?? groups.get(yearKeys[0])!;
  renderDayButtons(dayPanel, visibleDays, activeDay, onSelect);

  toolbar.appendChild(yearRow);
  appendViewTabsIfNeeded(toolbar, options);
  container.appendChild(toolbar);
  container.appendChild(dayPanel);
}
