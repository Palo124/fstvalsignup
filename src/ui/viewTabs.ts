export type AppView = 'lineup' | 'my-schedule';

const VIEW_LABELS: Record<AppView, string> = {
  lineup: 'Lineup',
  'my-schedule': 'My Schedule',
};

export function appendViewTabs(
  parent: HTMLElement,
  activeView: AppView,
  onSelect: (view: AppView) => void,
): void {
  const strip = document.createElement('div');
  strip.className = 'view-tab-strip';
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-label', 'Schedule views');

  for (const view of Object.keys(VIEW_LABELS) as AppView[]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'view-tab';
    button.textContent = VIEW_LABELS[view];
    button.dataset.view = view;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', view === activeView ? 'true' : 'false');

    if (view === activeView) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => onSelect(view));
    strip.appendChild(button);
  }

  parent.appendChild(strip);
}
