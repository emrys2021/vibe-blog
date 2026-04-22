'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || 'dark';
    setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage may be unavailable */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="toggle theme"
      className="text-fg-dim hover:text-accent transition-colors text-sm"
      title={theme === 'dark' ? 'switch to light' : 'switch to dark'}
    >
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  );
}
