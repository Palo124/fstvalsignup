export interface RawScheduleRow {
  rowIndex?: unknown;
  Artist?: unknown;
  Stage?: unknown;
  Time?: unknown;
  Attendees?: unknown;
  Color?: unknown;
}

export interface TimeRange {
  label: string;
  startMinutes: number;
  endMinutes: number;
}

export interface ScheduleItem {
  id: number;
  artist: string;
  stage: string;
  time: TimeRange;
  attendees: string[];
  color?: string;
}

export interface ScheduleViewRow {
  item: ScheduleItem;
  isNow: boolean;
  isPast: boolean;
  hasOverlap: boolean;
  start: Date;
  end: Date;
}

export interface ScheduleFilters {
  attendees: string[];
  stages: string[];
  overlapsOnly: boolean;
}
