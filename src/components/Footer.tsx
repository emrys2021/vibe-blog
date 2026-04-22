import { siteConfig } from '../../blog.config';

export function Footer() {
  return (
    <footer className="border-t border-rule mt-16">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-6 text-xs text-fg-dim flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          <span className="text-accent">$</span> echo &quot;© {new Date().getFullYear()} {siteConfig.author.name}&quot;
        </span>
        <span className="ml-auto flex gap-3">
          {siteConfig.social.map((s) => (
            <a
              key={s.label}
              href={s.href}
              className="hover:text-accent transition-colors"
              target={s.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              {s.label}
            </a>
          ))}
        </span>
      </div>
    </footer>
  );
}
