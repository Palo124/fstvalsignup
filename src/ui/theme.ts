import type { ThemePreference } from '../state/storage';

export function applyTheme(pref: ThemePreference): void {
  if (pref === 'dark') {
    document.body.classList.add('dark');
    return;
  }

  document.body.classList.toggle('dark', prefersDark());
}

export function bindSystemTheme(onChange: () => void): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onChange);
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
