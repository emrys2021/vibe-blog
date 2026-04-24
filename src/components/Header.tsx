import Link from 'next/link';
import { siteConfig } from '../../blog.config';
import { CommandMenuToggle } from './CommandMenuToggle';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header
      data-site-header
      className="border-b border-rule sticky top-0 z-40 backdrop-blur bg-bg/80"
    >
      <div className="max-w-4xl mx-auto px-5 sm:px-6 py-3 flex items-center gap-4">
        <Link
          href="/"
          className="shrink-0 text-accent font-semibold tracking-tight hover:opacity-80"
          aria-label="home"
        >
          <span className="text-fg-dim">$</span> {siteConfig.name}
        </Link>
        <nav className="min-w-0 flex items-center gap-3 md:gap-4 text-sm">
          {siteConfig.nav
            .filter((item) => item.href !== '/')
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-fg-dim hover:text-accent transition-colors"
              >
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CommandMenuToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
