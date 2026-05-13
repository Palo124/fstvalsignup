import type { ScheduleFilters, ScheduleItem } from '../types/schedule';

export function applyScheduleFilters(
  items: ScheduleItem[],
  filters: ScheduleFilters,
  overlapIds: Set<number>,
): ScheduleItem[] {
  return items.filter((item) => {
    if (filters.attendees.length > 0 && !filters.attendees.some((name) => item.attendees.includes(name))) {
      return false;
    }

    if (filters.stages.length > 0 && !filters.stages.includes(item.stage)) {
      return false;
    }

    if (filters.overlapsOnly && !overlapIds.has(item.id)) {
      return false;
    }

    return true;
  });
}
