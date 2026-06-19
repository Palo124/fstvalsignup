export interface DayTransitionElements {
  schedule: HTMLElement;
  tabs: HTMLElement;
}

let previewDay: string | null = null;
let loadingCount = 0;

function findDayTab(tabs: HTMLElement, day: string): HTMLButtonElement | null {
  return tabs.querySelector<HTMLButtonElement>(`.day-tab[data-day="${CSS.escape(day)}"]`);
}

export function previewSwipeDay(elements: DayTransitionElements, day: string | null): void {
  if (previewDay === day) {
    return;
  }

  if (previewDay) {
    findDayTab(elements.tabs, previewDay)?.classList.remove('is-swipe-target');
  }

  previewDay = day;

  if (day) {
    findDayTab(elements.tabs, day)?.classList.add('is-swipe-target');
  }
}

export function clearSwipePreview(elements: DayTransitionElements): void {
  previewSwipeDay(elements, null);
}

export function setDayLoadingFeedback(elements: DayTransitionElements, loading: boolean): void {
  loadingCount = loading ? loadingCount + 1 : Math.max(0, loadingCount - 1);
  elements.schedule.classList.toggle('is-day-loading', loadingCount > 0);
}
