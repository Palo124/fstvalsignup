import type { OverlapMap } from './overlaps';
import type { ScheduleItem } from '../types/schedule';

export interface DaySummary {
  totalShows: number;
  joinedCount: number;
  conflictCount: number;
  visibleShows: number;
}

export function computeDaySummary(
  items: ScheduleItem[],
  overlaps: OverlapMap,
  currentUser: string,
  visibleItems: ScheduleItem[],
): DaySummary {
  const normalizedUser = currentUser.trim();
  const joinedCount = normalizedUser
    ? items.filter((item) => item.attendees.includes(normalizedUser)).length
    : 0;
  const conflictCount = normalizedUser
    ? items.filter((item) => item.attendees.includes(normalizedUser) && overlaps.has(item.id)).length
    : 0;

  return {
    totalShows: items.length,
    joinedCount,
    conflictCount,
    visibleShows: visibleItems.length,
  };
}

export function formatDaySummary(summary: DaySummary, currentUser: string): string {
  const parts: string[] = [];

  if (currentUser.trim()) {
    parts.push(`${summary.joinedCount} joined`);
    if (summary.conflictCount > 0) {
      parts.push(`${summary.conflictCount} ${summary.conflictCount === 1 ? 'conflict' : 'conflicts'}`);
    }
  }

  parts.push(`${summary.totalShows} ${summary.totalShows === 1 ? 'show' : 'shows'}`);

  if (summary.visibleShows !== summary.totalShows) {
    parts.push(`${summary.visibleShows} visible`);
  }

  return parts.join(' · ');
}
