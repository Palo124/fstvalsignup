import { clear } from './dom';

export function renderTabs(
  container: HTMLElement,
  days: string[],
  activeDay: string,
  onSelect: (day: string) => void,
): void {
  clear(container);

  days.forEach((day) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day;
    button.dataset.day = day;

    if (day === activeDay) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => onSelect(day));
    container.appendChild(button);
  });
}
