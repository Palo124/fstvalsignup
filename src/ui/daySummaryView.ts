import { computeDaySummary, formatDaySummary, type DaySummary } from '../domain/daySummary';
import { applyScheduleFilters } from '../domain/filters';
import type { OverlapMap } from '../domain/overlaps';
import type { ScheduleFilters, ScheduleItem } from '../types/schedule';

interface RenderDaySummaryInput {
  container: HTMLElement;
  items: ScheduleItem[];
  filters: ScheduleFilters;
  overlaps: OverlapMap;
  currentUser: string;
}

export function renderDaySummary(input: RenderDaySummaryInput): void {
  const visibleItems = applyScheduleFilters(
    input.items,
    input.filters,
    input.overlaps,
    input.currentUser,
  );
  const summary = computeDaySummary(
    input.items,
    input.overlaps,
    input.currentUser,
    visibleItems,
  );

  input.container.hidden = false;
  input.container.textContent = formatDaySummary(summary, input.currentUser);
  input.container.dataset.conflicts = String(summary.conflictCount);
}

export function hideDaySummary(container: HTMLElement): void {
  container.hidden = true;
  container.textContent = '';
  delete container.dataset.conflicts;
}

export { type DaySummary };
