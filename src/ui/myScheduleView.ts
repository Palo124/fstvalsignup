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
import { clear, textElement } from './dom';
import type { ScheduleFilters, ScheduleItem } from '../types/schedule';

interface RenderMyScheduleInput {
  container: HTMLElement;
  items: ScheduleItem[];
  filters: ScheduleFilters;
  overlaps: OverlapMap;
  currentUser: string;
  dayDate: string | undefined;
  timeZoneOffset: string;
  preDawnCutoffMinutes: number;
  nowMs: number;
}

const PX_PER_MINUTE = 2.5;
const STAGE_COLUMN_MIN_WIDTH = 88;

export function renderMySchedule(input: RenderMyScheduleInput): void {
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

  const legend = document.createElement('p');
  wrapper.appendChild(legend);

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
  grid.appendChild(renderTimelineBody(stages, blocks, freeWindows, dayBounds, gridHeight, showNowLine, nowTopPx));

  scroll.appendChild(grid);
  wrapper.appendChild(scroll);
  input.container.appendChild(wrapper);
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
      column.appendChild(renderBlock(block, dayBounds));
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
): HTMLElement {
  const element = document.createElement('div');
  element.className = 'my-schedule-block';
  element.style.top = `${(block.start - dayBounds.start) * PX_PER_MINUTE}px`;
  element.style.height = `${Math.max((block.end - block.start) * PX_PER_MINUTE, 28)}px`;

  const stageColor = colorForStage(block.item.stage);
  if (stageColor) {
    element.style.borderColor = stageColor;
    element.style.backgroundColor = `${stageColor}33`;
  }

  element.append(
    textElement('div', block.item.artist, 'my-schedule-block-artist'),
    textElement('div', block.item.time.label, 'my-schedule-block-time'),
  );

  element.title = `${block.item.artist} · ${block.item.stage} · ${block.item.time.label}`;
  return element;
}
