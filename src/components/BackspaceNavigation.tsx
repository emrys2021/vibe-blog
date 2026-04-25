'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function BackspaceNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace') return;
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (shouldIgnoreBackspaceNavigation()) return;

      event.preventDefault();

      if (window.history.length > 1) {
        router.back();
        return;
      }

      if (pathname !== '/') {
        router.push('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pathname, router]);

  return null;
}

function shouldIgnoreBackspaceNavigation() {
  if (document.querySelector('[aria-modal="true"]')) {
    return true;
  }

  const activeElement = document.activeElement;
  if (!activeElement || !(activeElement instanceof HTMLElement)) {
    return false;
  }

  if (activeElement.isContentEditable) {
    return true;
  }

  const editableRoot = activeElement.closest(
    'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
  );

  return Boolean(editableRoot);
}
