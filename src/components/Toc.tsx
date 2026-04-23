'use client';

import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/types';

/**
 * Sidebar table of contents with scrollspy. Active item is the last heading
 * whose top has crossed an activation line ~120px below the viewport top,
 * which clears the sticky header and gives a little breathing room.
 */
export function Toc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const ACTIVATION_OFFSET = 120;

    const update = () => {
      let active = '';
      for (const h of headings) {
        if (h.getBoundingClientRect().top - ACTIVATION_OFFSET <= 0) {
          active = h.id;
        } else {
          break;
        }
      }
      setActiveId(active);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="table of contents" className="text-xs">
      <div className="text-fg-dim mb-3 uppercase tracking-wide"># toc</div>
      <ul className="space-y-1.5 border-l border-rule">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li
              key={item.id}
              style={{ paddingLeft: `${0.75 + (item.depth - 2) * 0.9}rem` }}
              className={
                isActive
                  ? '-ml-0.5 border-l-2 border-accent'
                  : '-ml-px'
              }
            >
              <a
                href={`#${item.id}`}
                style={{ fontFamily: 'var(--font-prose)' }}
                className={`block py-0.5 transition-colors leading-snug ${
                  isActive
                    ? 'text-accent font-medium'
                    : 'text-fg-dim hover:text-accent'
                }`}
              >
                {item.value}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
