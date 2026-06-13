import type { ScheduleItem } from '../types/schedule';

export interface OverlapPartner {
  id: number;
  artist: string;
  stage: string;
  timeLabel: string;
}

export type OverlapMap = Map<number, OverlapPartner[]>;

export function computeOverlaps(items: ScheduleItem[], nickname: string): OverlapMap {
  const normalizedNickname = nickname.trim();
  const overlaps: OverlapMap = new Map();
  if (!normalizedNickname) return overlaps;

  const attending = items
    .filter((item) => item.attendees.includes(normalizedNickname))
    .sort((left, right) => left.time.startMinutes - right.time.startMinutes);

  for (let i = 0; i < attending.length; i += 1) {
    for (let j = i + 1; j < attending.length; j += 1) {
      if (attending[j].time.startMinutes >= attending[i].time.endMinutes) break;

      addOverlap(overlaps, attending[i], attending[j]);
    }
  }

  return overlaps;
}

function addOverlap(overlaps: OverlapMap, left: ScheduleItem, right: ScheduleItem): void {
  appendPartner(overlaps, left.id, toPartner(right));
  appendPartner(overlaps, right.id, toPartner(left));
}

function appendPartner(overlaps: OverlapMap, id: number, partner: OverlapPartner): void {
  const existing = overlaps.get(id);
  if (existing) {
    existing.push(partner);
    return;
  }

  overlaps.set(id, [partner]);
}

function toPartner(item: ScheduleItem): OverlapPartner {
  return {
    id: item.id,
    artist: item.artist,
    stage: item.stage,
    timeLabel: item.time.label,
  };
}
