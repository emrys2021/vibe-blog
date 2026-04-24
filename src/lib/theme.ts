export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage may be unavailable */
  }
}

export function toggleTheme(currentTheme?: Theme): Theme {
  const next = (currentTheme ?? getTheme()) === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
