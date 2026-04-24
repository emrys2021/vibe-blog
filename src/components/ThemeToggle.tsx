'use client';

import { useEffect, useState } from 'react';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  const toggle = () => {
    setTheme(toggleTheme(theme));
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
