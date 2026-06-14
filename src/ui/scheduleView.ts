import { colorForStage } from '../stageColors';
import { clear, textElement } from './dom';
import { applyScheduleFilters } from '../domain/filters';
import type { OverlapMap, OverlapPartner } from '../domain/overlaps';
import { intervalDates, progressRemaining } from '../domain/time';
import type { ScheduleFilters, ScheduleItem, ScheduleViewRow } from '../types/schedule';

interface RenderScheduleInput {
  container: HTMLElement;
  items: ScheduleItem[];
  filters: ScheduleFilters;
  overlaps: OverlapMap;
  currentUser: string;
  dayDate: string | undefined;
  timeZoneOffset: string;
  preDawnCutoffMinutes: number;
  pinNowPlaying: boolean;
  dimPastShows: boolean;
  nowMs: number;
  onToggle: (item: ScheduleItem, event: MouseEvent) => void;
}

const palette = [
  '#e57373',
  '#81c784',
  '#64b5f6',
  '#ffd54f',
  '#ba68c8',
  '#4db6ac',
  '#f06292',
  '#7986cb',
  '#4fc3f7',
  '#ff8a65',
  '#a1887f',
  '#7f85c7',
];

const spotifyIconPath =
  'M84 0a84 84 0 1 0 .001 168.001A84 84 0 0 0 84 0zm38.4 121.1a5.25 5.25 0 0 1-7.2 1.6c-19.8-12.1-44.8-14.8-74.4-8.1a5.27 5.27 0 0 1-2.4-10.2c32.6-7.7 60.7-4.6 83.6 9.3a5.23 5.23 0 0 1 .7 7.4zm10.2-20.4a6.6 6.6 0 0 1-9 2.1c-22.7-14-57.3-18.1-84-9.9a6.6 6.6 0 1 1-3.6-12.7c31.4-8.8 69.3-4.3 95.5 11.1a6.6 6.6 0 0 1 2.1 9.4zm.9-20.9c-27.1-16.2-72.1-17.6-98-9.7a7.88 7.88 0 1 1-4.5-15.1c29.6-8.7 79.2-7.1 110.5 11.3a7.9 7.9 0 0 1-8 13.5z';

export function showLoading(container: HTMLElement, message = 'Loading...'): void {
  if (message === 'Loading...') {
    const wrapper = document.createElement('div');
    wrapper.className = 'loading';

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-label', 'Loading');

    wrapper.appendChild(spinner);
    container.replaceChildren(wrapper);
    return;
  }

  container.replaceChildren(textElement('div', message, 'loading'));
}

export function showError(container: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  container.replaceChildren(textElement('div', `Failed to load schedule: ${message}`, 'loading'));
}

export function renderSchedule(input: RenderScheduleInput): void {
  clear(input.container);

  if (!input.dayDate) {
    input.container.appendChild(textElement('div', 'Missing calendar date for this festival day.', 'loading'));
    return;
  }

  const filteredItems = applyScheduleFilters(input.items, input.filters, input.overlaps);
  const rows = toViewRows(filteredItems, input);

  if (rows.length === 0) {
    input.container.appendChild(textElement('div', 'No performances match your filters.', 'loading'));
    return;
  }

  const nowRows = input.pinNowPlaying ? rows.filter((row) => row.isNow) : [];
  const laterRows = input.pinNowPlaying ? rows.filter((row) => !row.isNow) : rows;
  const renderRows = [...nowRows, ...laterRows];

  renderRows.forEach((row, index) => {
    if (input.pinNowPlaying && nowRows.length > 0 && index === nowRows.length) {
      const divider = document.createElement('hr');
      divider.className = 'divider-line';
      input.container.appendChild(divider);
    }

    input.container.appendChild(renderCard(row, input));
  });
}

function toViewRows(items: ScheduleItem[], input: RenderScheduleInput): ScheduleViewRow[] {
  return items.map((item) => {
    const { start, end } = intervalDates(
      input.dayDate ?? '',
      item.time,
      input.timeZoneOffset,
      input.preDawnCutoffMinutes,
    );
    const isNow = input.nowMs >= start.getTime() && input.nowMs < end.getTime();

    const overlaps = input.overlaps.get(item.id) ?? [];

    return {
      item,
      isNow,
      isPast: input.nowMs >= end.getTime(),
      overlaps,
      hasOverlap: overlaps.length > 0,
      start,
      end,
    };
  });
}

function renderCard(row: ScheduleViewRow, input: RenderScheduleInput): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';

  if (row.isPast && input.dimPastShows) {
    card.classList.add('past-show');
    const pastRow = document.createElement('div');
    pastRow.className = 'past-row';
    pastRow.append(textElement('span', row.item.artist, 'artist-name'), textElement('span', row.item.time.label, 'time'));
    card.appendChild(pastRow);
    return card;
  }

  if (row.isNow) {
    card.classList.add('now-playing');
  } else {
    const stageColor = colorForStage(row.item.stage);
    if (stageColor) {
      card.style.borderColor = stageColor;
    }
  }

  if (row.hasOverlap) {
    card.classList.add('has-collision');
  }

  card.append(
    renderTags(row),
    textElement('div', row.item.stage, 'stage-tag'),
    renderArtist(row.item),
  );

  if (row.isNow) {
    card.appendChild(renderProgress(row, input.nowMs));
  }

  card.append(renderAttendees(row.item.attendees), renderToggleButton(row.item, input));
  return card;
}

function renderTags(row: ScheduleViewRow): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tag-container';

  if (row.isNow) {
    container.appendChild(textElement('div', 'Now Playing', 'now-playing-tag'));
  }

  if (row.hasOverlap) {
    container.appendChild(renderCollisionTag(row.overlaps));
  }

  return container;
}

function renderCollisionTag(partners: OverlapPartner[]): HTMLElement {
  if (partners.length === 1) {
    const tag = document.createElement('div');
    tag.className = 'collision-tag';
    tag.textContent = `Collides with ${formatCollisionPartner(partners[0])}`;
    return tag;
  }

  const wrap = document.createElement('div');
  wrap.className = 'collision-tag-wrap';

  const details = document.createElement('details');
  details.className = 'collision-details';

  const summary = document.createElement('summary');
  summary.className = 'collision-tag';
  summary.textContent = 'Collision';

  const popover = document.createElement('div');
  popover.className = 'collision-popover';
  popover.setAttribute('role', 'list');

  partners.forEach((partner) => {
    const item = document.createElement('div');
    item.className = 'collision-popover-item';
    item.setAttribute('role', 'listitem');
    item.textContent = formatCollisionPartner(partner);
    popover.appendChild(item);
  });

  details.append(summary, popover);
  details.addEventListener('toggle', () => {
    if (details.open) {
      document.querySelectorAll<HTMLDetailsElement>('.collision-details[open]').forEach((openDetails) => {
        if (openDetails !== details) {
          openDetails.open = false;
        }
      });
    }

    const card = details.closest('.card');
    card?.classList.toggle('collision-open', details.open);
  });
  wrap.appendChild(details);
  return wrap;
}

function formatCollisionPartner(partner: OverlapPartner): string {
  return `${partner.artist} (${partner.stage}, ${partner.timeLabel})`;
}

function renderArtist(item: ScheduleItem): HTMLElement {
  const artist = document.createElement('div');
  artist.className = 'artist';
  artist.append(textElement('span', item.artist, 'artist-name'), textElement('span', item.time.label, 'time'), renderSpotifyLink(item.artist));
  return artist;
}

function renderSpotifyLink(artist: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = `https://open.spotify.com/search/${encodeURIComponent(searchableArtistName(artist))}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'spotify-link';
  link.title = 'Search on Spotify';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'spotify-icon');
  svg.setAttribute('viewBox', '0 0 168 168');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', '#1ED760');
  path.setAttribute('d', spotifyIconPath);
  svg.appendChild(path);
  link.appendChild(svg);

  return link;
}

function renderProgress(row: ScheduleViewRow, nowMs: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'progress-container';

  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.style.width = `${progressRemaining(row.start, row.end, nowMs)}%`;
  container.appendChild(bar);

  return container;
}

function renderAttendees(attendees: string[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'attendees';

  if (attendees.length === 0) {
    container.textContent = 'No one yet';
    return container;
  }

  attendees.forEach((attendee) => {
    const tag = textElement('span', attendee, 'attendee-tag');
    tag.style.borderColor = attendeeColor(attendee);
    container.appendChild(tag);
  });

  return container;
}

function renderToggleButton(item: ScheduleItem, input: RenderScheduleInput): HTMLButtonElement {
  const isAttending = input.currentUser.length > 0 && item.attendees.includes(input.currentUser);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = isAttending ? 'leave' : 'join';
  button.textContent = isAttending ? 'Leave' : 'Join';
  button.addEventListener('click', (event) => input.onToggle(item, event));
  return button;
}

function attendeeColor(name: string): string {
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return palette[Math.abs(hash) % palette.length];
}

function searchableArtistName(artist: string): string {
  return artist.replace(/\s*\([^)]+\)/, '');
}
