import type { AppView } from './viewTabs';

const SWIPE_THRESHOLD_PX = 60;
const SWIPE_PREVIEW_PX = 20;
const SWIPE_DIRECTION_RATIO = 1.2;

export interface DaySwipeOptions {
  getActiveView: () => AppView;
  getDays: () => readonly string[];
  getCurrentDay: () => string;
  onSelectDay: (day: string) => void;
  onSwipePreview?: (day: string | null) => void;
  isBlocked?: () => boolean;
}

function resolveSwipeTarget(
  days: readonly string[],
  currentDay: string,
  deltaX: number,
): string | null {
  const currentIndex = days.indexOf(currentDay);
  if (currentIndex === -1) {
    return null;
  }

  if (deltaX < 0 && currentIndex < days.length - 1) {
    return days[currentIndex + 1];
  }

  if (deltaX > 0 && currentIndex > 0) {
    return days[currentIndex - 1];
  }

  return null;
}

function isHorizontalSwipe(deltaX: number, deltaY: number, threshold: number): boolean {
  return Math.abs(deltaX) >= threshold && Math.abs(deltaX) >= Math.abs(deltaY) * SWIPE_DIRECTION_RATIO;
}

export function initDaySwipe(element: HTMLElement, options: DaySwipeOptions): void {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const clearPreview = (): void => {
    options.onSwipePreview?.(null);
  };

  element.addEventListener(
    'touchstart',
    (event) => {
      if (options.isBlocked?.()) {
        return;
      }
      if (options.getActiveView() !== 'lineup') {
        return;
      }
      if (event.touches.length !== 1) {
        return;
      }

      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    },
    { passive: true },
  );

  element.addEventListener(
    'touchmove',
    (event) => {
      if (!tracking || options.isBlocked?.() || options.getActiveView() !== 'lineup') {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!isHorizontalSwipe(deltaX, deltaY, SWIPE_PREVIEW_PX)) {
        clearPreview();
        return;
      }

      options.onSwipePreview?.(resolveSwipeTarget(options.getDays(), options.getCurrentDay(), deltaX));
    },
    { passive: true },
  );

  element.addEventListener(
    'touchend',
    (event) => {
      if (!tracking) {
        return;
      }
      tracking = false;

      if (options.isBlocked?.()) {
        clearPreview();
        return;
      }
      if (options.getActiveView() !== 'lineup') {
        clearPreview();
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      clearPreview();

      if (!isHorizontalSwipe(deltaX, deltaY, SWIPE_THRESHOLD_PX)) {
        return;
      }

      const targetDay = resolveSwipeTarget(options.getDays(), options.getCurrentDay(), deltaX);
      if (targetDay) {
        options.onSelectDay(targetDay);
      }
    },
    { passive: true },
  );

  element.addEventListener(
    'touchcancel',
    () => {
      tracking = false;
      clearPreview();
    },
    { passive: true },
  );
}
