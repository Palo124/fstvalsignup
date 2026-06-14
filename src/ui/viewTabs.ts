import { clear } from './dom';

export type AppView = 'lineup' | 'my-schedule';

const VIEW_LABELS: Record<AppView, string> = {
  lineup: 'Lineup',
  'my-schedule': 'My Schedule',
};

export function renderViewTabs(
  container: HTMLElement,
  activeView: AppView,
  onSelect: (view: AppView) => void,
): void {
  clear(container);

  for (const view of Object.keys(VIEW_LABELS) as AppView[]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'view-tab';
    button.textContent = VIEW_LABELS[view];
    button.dataset.view = view;
    button.setAttribute('aria-pressed', view === activeView ? 'true' : 'false');

    if (view === activeView) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => onSelect(view));
    container.appendChild(button);
  }
}
