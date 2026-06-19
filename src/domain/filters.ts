import type { OverlapMap } from '../domain/overlaps';
import type { ScheduleFilters, ScheduleItem } from '../types/schedule';

export function applyScheduleFilters(
  items: ScheduleItem[],
  filters: ScheduleFilters,
  overlaps: OverlapMap,
  currentUser = '',
): ScheduleItem[] {
  const normalizedUser = currentUser.trim();

  const normalizedQuery = filters.query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (normalizedQuery) {
      const haystack = `${item.artist} ${item.stage}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }

    if (filters.attendees.length > 0 && !filters.attendees.some((name) => item.attendees.includes(name))) {
      return false;
    }

    if (filters.stages.length > 0 && !filters.stages.includes(item.stage)) {
      return false;
    }

    if (filters.overlapsOnly && !overlaps.has(item.id)) {
      return false;
    }

    if (filters.joinedOnly && (!normalizedUser || !item.attendees.includes(normalizedUser))) {
      return false;
    }

    if (filters.hasJoinersOnly && item.attendees.length === 0) {
      return false;
    }

    return true;
  });

  if (!filters.popularOnly) {
    return filtered;
  }

  const maxAttendees = filtered.reduce((max, item) => Math.max(max, item.attendees.length), 0);

  if (maxAttendees === 0) {
    return [];
  }

  return filtered.filter((item) => item.attendees.length === maxAttendees);
}

export function maxAttendeeCount(items: ScheduleItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.attendees.length), 0);
}
