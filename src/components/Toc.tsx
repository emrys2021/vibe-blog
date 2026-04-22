import type { TocItem } from '@/lib/types';

/**
 * Sidebar table of contents. Designed to live in a sticky aside on the
 * left of the article on lg+ screens.
 */
export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="table of contents" className="text-xs">
      <div className="text-fg-dim mb-3 uppercase tracking-wide">
        # toc
      </div>
      <ul className="space-y-1.5 border-l border-rule">
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              paddingLeft: `${0.75 + (item.depth - 2) * 0.9}rem`,
            }}
            className="-ml-px"
          >
            <a
              href={`#${item.id}`}
              className="block py-0.5 text-fg-dim hover:text-accent transition-colors leading-snug"
            >
              {item.value}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
