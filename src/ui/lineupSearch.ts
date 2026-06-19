import { loadString, saveString, storageKeys } from '../state/storage';

export interface LineupSearchElements {
  toggle: HTMLButtonElement;
  row: HTMLElement;
  input: HTMLInputElement;
}

let searchExpanded = false;

export function initLineupSearch(elements: LineupSearchElements, onChange: () => void): void {
  elements.input.value = loadString(storageKeys.filterQuery);

  function syncUi(): void {
    const hasQuery = elements.input.value.trim().length > 0;
    elements.row.hidden = !searchExpanded;
    elements.toggle.setAttribute('aria-expanded', String(searchExpanded));
    elements.toggle.classList.toggle('is-active', searchExpanded || hasQuery);
  }

  function setExpanded(expanded: boolean, focusInput = false): void {
    searchExpanded = expanded;
    syncUi();
    if (focusInput && expanded) {
      elements.input.focus();
    }
  }

  elements.toggle.addEventListener('click', () => {
    setExpanded(!searchExpanded, true);
  });

  elements.input.addEventListener('input', () => {
    saveString(storageKeys.filterQuery, elements.input.value);
    syncUi();
    onChange();
  });

  elements.input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setExpanded(false);
      elements.toggle.focus();
    }
  });

  syncUi();
}

export function readLineupSearchQuery(input: HTMLInputElement): string {
  return input.value.trim();
}

export function syncLineupSearchToolbar(
  elements: LineupSearchElements,
  visible: boolean,
): void {
  if (!visible) {
    searchExpanded = false;
  }

  elements.toggle.hidden = !visible;
  elements.row.hidden = !visible || !searchExpanded;

  if (visible) {
    const hasQuery = elements.input.value.trim().length > 0;
    elements.toggle.setAttribute('aria-expanded', String(searchExpanded));
    elements.toggle.classList.toggle('is-active', searchExpanded || hasQuery);
  }
}
