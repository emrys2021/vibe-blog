import Link from 'next/link';
import { siteConfig } from '../../blog.config';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="border-b border-rule sticky top-0 z-40 backdrop-blur bg-bg/80">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-3 flex items-center gap-4">
        <Link
          href="/"
          className="text-accent font-semibold tracking-tight hover:opacity-80"
          aria-label="home"
        >
          <span className="text-fg-dim">$</span> {siteConfig.name}
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-sm">
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
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
