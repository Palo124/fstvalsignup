import { applyScheduleFilters } from '../domain/filters';
import { allStages } from '../domain/schedule';
import {
  computeDayBounds,
  computeFreeWindows,
  festivalTimelineMinuteForNow,
  formatFestivalTimelineMinute,
  timelineHourMarks,
  toMyScheduleBlocks,
  zonedDateParts,
} from '../domain/myScheduleTimeline';
import type { OverlapMap } from '../domain/overlaps';
import { colorForStage } from '../stageColors';
import { colorForAttendee } from './attendeeColor';
import { clear, textElement } from './dom';
import type { ScheduleFilters, ScheduleItem } from '../types/schedule';

interface RenderMyScheduleInput {
  container: HTMLElement;
  items: ScheduleItem[];
  filters: ScheduleFilters;
  overlaps: OverlapMap;
  currentUser: string;
  dayKey: string;
  dayDate: string | undefined;
  timeZoneOffset: string;
  preDawnCutoffMinutes: number;
  nowMs: number;
  onSelectItem: (item: ScheduleItem) => void;
}

const PX_PER_MINUTE = 1.25;
const STAGE_COLUMN_MIN_WIDTH = 88;
const BLOCK_MIN_HEIGHT_PX = 20;
const scrollStateByDay = new Map<string, { top: number; left: number }>();
let myScheduleExpanded = false;
let activeFullscreenWrapper: HTMLElement | null = null;
let activeFullscreenButton: HTMLButtonElement | null = null;

function syncFullscreenUi(): void {
  const wrapper = activeFullscreenWrapper;
  const button = activeFullscreenButton;
  if (!wrapper || !button) {
    return;
  }

  const nativeFullscreen = document.fullscreenElement === wrapper;
  myScheduleExpanded = nativeFullscreen || wrapper.classList.contains('my-schedule--expanded');
  setFullscreenButtonState(button, myScheduleExpanded);
  document.body.classList.toggle('my-schedule-expanded-open', myScheduleExpanded);
}

document.addEventListener('fullscreenchange', syncFullscreenUi);

export function exitMyScheduleFullscreenIfActive(): void {
  if (!myScheduleExpanded) {
    return;
  }

  if (document.fullscreenElement instanceof HTMLElement) {
    void document.exitFullscreen();
  }

  activeFullscreenWrapper?.classList.remove('my-schedule--expanded');
  myScheduleExpanded = false;
  syncFullscreenUi();
}

export function renderMySchedule(input: RenderMyScheduleInput): void {
  const existingScroll = input.container.querySelector<HTMLElement>('.my-schedule-scroll');
  if (existingScroll) {
    scrollStateByDay.set(input.dayKey, {
      top: existingScroll.scrollTop,
      left: existingScroll.scrollLeft,
    });
  }

  clear(input.container);

  const filteredItems = applyScheduleFilters(
    input.items,
    input.filters,
    input.overlaps,
    input.currentUser,
  );
  const dayBounds = computeDayBounds(filteredItems, input.preDawnCutoffMinutes);

  if (!dayBounds || filteredItems.length === 0) {
    const message =
      input.filters.joinedOnly && !input.currentUser.trim()
        ? 'Enter your nickname in the menu to see your joined performances.'
        : 'No performances match your filters.';
    input.container.appendChild(textElement('div', message, 'loading'));
    return;
  }

  const stages = allStages(filteredItems);
  const blocks = toMyScheduleBlocks(filteredItems, input.preDawnCutoffMinutes);
  const freeWindows = computeFreeWindows(filteredItems, dayBounds, input.preDawnCutoffMinutes);
  const totalMinutes = dayBounds.end - dayBounds.start;
  const gridHeight = totalMinutes * PX_PER_MINUTE;
  const nowTimelineMinute = festivalTimelineMinuteForNow(
    input.nowMs,
    input.dayDate,
    input.timeZoneOffset,
    input.preDawnCutoffMinutes,
  );
  const showNowLine =
    nowTimelineMinute !== null &&
    nowTimelineMinute >= dayBounds.start &&
    nowTimelineMinute <= dayBounds.end;
  const nowTopPx = showNowLine ? (nowTimelineMinute - dayBounds.start) * PX_PER_MINUTE : 0;
  const nowLabel = showNowLine ? formatNowClockLabel(input.nowMs, input.timeZoneOffset) : '';

  const wrapper = document.createElement('div');
  wrapper.className = 'my-schedule';
  if (myScheduleExpanded) {
    wrapper.classList.add('my-schedule--expanded');
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'my-schedule-toolbar';

  const fullscreenButton = document.createElement('button');
  fullscreenButton.type = 'button';
  fullscreenButton.className = 'my-schedule-fullscreen-toggle';
  fullscreenButton.setAttribute('aria-label', 'Enter full screen');
  bindFullscreenToggle(wrapper, fullscreenButton);

  toolbar.appendChild(fullscreenButton);
  wrapper.appendChild(toolbar);

  const scroll = document.createElement('div');
  scroll.className = 'my-schedule-scroll';

  const grid = document.createElement('div');
  grid.className = 'my-schedule-grid';
  grid.style.setProperty('--timeline-height', `${gridHeight}px`);
  grid.style.setProperty('--stage-count', String(stages.length));
  grid.style.setProperty('--stage-min-width', `${STAGE_COLUMN_MIN_WIDTH}px`);

  grid.appendChild(renderCorner());
  grid.appendChild(renderStageHeaderRow(stages));
  grid.appendChild(renderTimeAxis(dayBounds, gridHeight, showNowLine, nowTopPx, nowLabel));
  grid.appendChild(renderTimelineBody(stages, blocks, freeWindows, dayBounds, gridHeight, showNowLine, nowTopPx, input.currentUser, input.onSelectItem));

  scroll.appendChild(grid);
  wrapper.appendChild(scroll);
  input.container.appendChild(wrapper);

  const savedScroll = scrollStateByDay.get(input.dayKey);
  if (savedScroll) {
    scroll.scrollTop = savedScroll.top;
    scroll.scrollLeft = savedScroll.left;
  }

  if (myScheduleExpanded && document.fullscreenElement !== wrapper) {
    void wrapper.requestFullscreen().catch(() => {
      wrapper.classList.add('my-schedule--expanded');
    });
  }

  scroll.addEventListener(
    'scroll',
    () => {
      scrollStateByDay.set(input.dayKey, {
        top: scroll.scrollTop,
        left: scroll.scrollLeft,
      });
    },
    { passive: true },
  );
}

function renderCorner(): HTMLElement {
  const corner = document.createElement('div');
  corner.className = 'my-schedule-corner';
  corner.setAttribute('aria-hidden', 'true');
  return corner;
}

function renderStageHeaderRow(stages: string[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'my-schedule-stage-header-row';

  stages.forEach((stage) => {
    const header = document.createElement('div');
    header.className = 'my-schedule-stage-header';
    header.textContent = stage;
    header.title = stage;

    const stageColor = colorForStage(stage);
    if (stageColor) {
      header.style.borderBottomColor = stageColor;
    }

    row.appendChild(header);
  });

  return row;
}

function formatNowClockLabel(nowMs: number, timeZoneOffset: string): string {
  const { minutes } = zonedDateParts(nowMs, timeZoneOffset);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function renderNowLine(topPx: number, label: string, variant: 'axis' | 'body'): HTMLElement {
  const line = document.createElement('div');
  line.className = `my-schedule-now-line my-schedule-now-line--${variant}`;
  line.style.top = `${topPx}px`;
  line.setAttribute('aria-hidden', variant === 'body' ? 'true' : 'false');

  if (variant === 'axis') {
    line.setAttribute('aria-label', `Current time ${label}`);
    line.appendChild(textElement('span', label, 'my-schedule-now-label'));
  }

  return line;
}

function renderTimeAxis(
  dayBounds: { start: number; end: number },
  gridHeight: number,
  showNowLine: boolean,
  nowTopPx: number,
  nowLabel: string,
): HTMLElement {
  const axis = document.createElement('div');
  axis.className = 'my-schedule-time-axis';
  axis.style.height = `${gridHeight}px`;

  timelineHourMarks(dayBounds).forEach((minute) => {
    const label = document.createElement('div');
    label.className = 'my-schedule-time-label';
    label.textContent = formatFestivalTimelineMinute(minute);
    label.style.top = `${(minute - dayBounds.start) * PX_PER_MINUTE}px`;
    axis.appendChild(label);
  });

  if (showNowLine) {
    axis.appendChild(renderNowLine(nowTopPx, nowLabel, 'axis'));
  }

  return axis;
}

function renderTimelineBody(
  stages: string[],
  blocks: ReturnType<typeof toMyScheduleBlocks>,
  freeWindows: ReturnType<typeof computeFreeWindows>,
  dayBounds: { start: number; end: number },
  gridHeight: number,
  showNowLine: boolean,
  nowTopPx: number,
  currentUser: string,
  onSelectItem: (item: ScheduleItem) => void,
): HTMLElement {
  const body = document.createElement('div');
  body.className = 'my-schedule-body';
  body.style.height = `${gridHeight}px`;

  freeWindows.forEach((window) => {
    const band = document.createElement('div');
    band.className = 'my-schedule-free-window';
    band.style.top = `${(window.start - dayBounds.start) * PX_PER_MINUTE}px`;
    band.style.height = `${(window.end - window.start) * PX_PER_MINUTE}px`;
    band.title = `${formatFestivalTimelineMinute(window.start)} – ${formatFestivalTimelineMinute(window.end)} free`;
    body.appendChild(band);
  });

  timelineHourMarks(dayBounds).forEach((minute) => {
    const line = document.createElement('div');
    line.className = 'my-schedule-hour-line';
    line.style.top = `${(minute - dayBounds.start) * PX_PER_MINUTE}px`;
    body.appendChild(line);
  });

  const blocksByStage = new Map<string, typeof blocks>();
  blocks.forEach((block) => {
    const stageBlocks = blocksByStage.get(block.item.stage) ?? [];
    stageBlocks.push(block);
    blocksByStage.set(block.item.stage, stageBlocks);
  });

  stages.forEach((stage) => {
    const column = document.createElement('div');
    column.className = 'my-schedule-stage-column';

    const stageColor = colorForStage(stage);
    if (stageColor) {
      column.style.setProperty('--stage-color', stageColor);
    }

    (blocksByStage.get(stage) ?? []).forEach((block) => {
      column.appendChild(renderBlock(block, dayBounds, currentUser, onSelectItem));
    });

    body.appendChild(column);
  });

  if (showNowLine) {
    body.appendChild(renderNowLine(nowTopPx, '', 'body'));
  }

  return body;
}

function renderBlock(
  block: ReturnType<typeof toMyScheduleBlocks>[number],
  dayBounds: { start: number; end: number },
  currentUser: string,
  onSelectItem: (item: ScheduleItem) => void,
): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'my-schedule-block';
  element.style.top = `${(block.start - dayBounds.start) * PX_PER_MINUTE}px`;
  element.style.height = `${Math.max((block.end - block.start) * PX_PER_MINUTE, BLOCK_MIN_HEIGHT_PX)}px`;

  const stageColor = colorForStage(block.item.stage);
  if (stageColor) {
    element.style.borderColor = stageColor;
    element.style.backgroundColor = `${stageColor}33`;
  }

  element.append(
    textElement('div', block.item.artist, 'my-schedule-block-artist'),
    textElement('div', block.item.time.label, 'my-schedule-block-time'),
    renderAttendeeDots(block.item.attendees, currentUser),
  );

  const attendeeLabel =
    block.item.attendees.length > 0 ? ` · ${block.item.attendees.join(', ')}` : '';
  element.title = `${block.item.artist} · ${block.item.stage} · ${block.item.time.label}${attendeeLabel} — open in lineup`;
  element.addEventListener('click', () => {
    onSelectItem(block.item);
  });
  return element;
}

function renderAttendeeDots(attendees: string[], currentUser: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'my-schedule-block-attendees';

  if (attendees.length === 0) {
    return container;
  }

  const normalizedUser = currentUser.trim();

  attendees.forEach((attendee) => {
    const dot = document.createElement('span');
    dot.className = 'my-schedule-attendee-dot';
    dot.style.backgroundColor = colorForAttendee(attendee);
    dot.title = attendee;

    if (normalizedUser && attendee === normalizedUser) {
      dot.classList.add('is-current-user');
    }

    container.appendChild(dot);
  });

  return container;
}

function setFullscreenButtonState(button: HTMLButtonElement, expanded: boolean): void {
  button.setAttribute('aria-pressed', String(expanded));
  button.setAttribute('aria-label', expanded ? 'Exit full screen' : 'Enter full screen');
  button.replaceChildren(createFullscreenIcon(expanded));
}

function createFullscreenIcon(expanded: boolean): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'my-schedule-fullscreen-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute(
    'd',
    expanded
      ? 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z'
      : 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
  );
  svg.appendChild(path);

  return svg;
}

function bindFullscreenToggle(wrapper: HTMLElement, button: HTMLButtonElement): void {
  activeFullscreenWrapper = wrapper;
  activeFullscreenButton = button;

  button.addEventListener('click', () => {
    void toggleMyScheduleFullscreen(wrapper);
  });

  syncFullscreenUi();
}

async function toggleMyScheduleFullscreen(wrapper: HTMLElement): Promise<void> {
  if (document.fullscreenElement === wrapper || wrapper.classList.contains('my-schedule--expanded')) {
    if (document.fullscreenElement === wrapper) {
      await document.exitFullscreen();
    }
    wrapper.classList.remove('my-schedule--expanded');
    myScheduleExpanded = false;
    syncFullscreenUi();
    return;
  }

  try {
    await wrapper.requestFullscreen();
    myScheduleExpanded = true;
    syncFullscreenUi();
  } catch {
    wrapper.classList.add('my-schedule--expanded');
    myScheduleExpanded = true;
    syncFullscreenUi();
  }
}
