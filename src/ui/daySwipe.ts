import type { AppView } from './viewTabs';

const SWIPE_THRESHOLD_PX = 60;
const SWIPE_DIRECTION_RATIO = 1.2;

export interface DaySwipeOptions {
  getActiveView: () => AppView;
  getDays: () => readonly string[];
  getCurrentDay: () => string;
  onSelectDay: (day: string) => void;
  isBlocked?: () => boolean;
}

export function initDaySwipe(element: HTMLElement, options: DaySwipeOptions): void {
  let startX = 0;
  let startY = 0;
  let tracking = false;

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
    'touchend',
    (event) => {
      if (!tracking) {
        return;
      }
      tracking = false;

      if (options.isBlocked?.()) {
        return;
      }
      if (options.getActiveView() !== 'lineup') {
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) {
        return;
      }
      if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) {
        return;
      }

      const days = options.getDays();
      const currentIndex = days.indexOf(options.getCurrentDay());
      if (currentIndex === -1) {
        return;
      }

      if (deltaX < 0 && currentIndex < days.length - 1) {
        options.onSelectDay(days[currentIndex + 1]);
        return;
      }

      if (deltaX > 0 && currentIndex > 0) {
        options.onSelectDay(days[currentIndex - 1]);
      }
    },
    { passive: true },
  );

  element.addEventListener(
    'touchcancel',
    () => {
      tracking = false;
    },
    { passive: true },
  );
}
