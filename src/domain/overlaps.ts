import type { ScheduleItem } from '../types/schedule';

export function computeOverlaps(items: ScheduleItem[], nickname: string): Set<number> {
  const normalizedNickname = nickname.trim();
  if (!normalizedNickname) return new Set();

  const ranges = items
    .filter((item) => item.attendees.includes(normalizedNickname))
    .map((item) => ({
      id: item.id,
      start: item.time.startMinutes,
      end: item.time.endMinutes,
    }))
    .sort((left, right) => left.start - right.start);

  const overlapping = new Set<number>();

  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      if (ranges[j].start >= ranges[i].end) break;

      overlapping.add(ranges[i].id);
      overlapping.add(ranges[j].id);
    }
  }

  return overlapping;
}
