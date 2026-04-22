import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { siteConfig } from '../../blog.config';

export const metadata: Metadata = {
  title: {
    default: siteConfig.title,
    template: `%s · ${siteConfig.title}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  authors: [{ name: siteConfig.author.name }],
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Inline script avoids the dark→light flash on first paint.
  const themeBoot = `
    (function() {
      try {
        var t = localStorage.getItem('theme');
        if (!t) { t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
        document.documentElement.dataset.theme = t;
      } catch (_) { document.documentElement.dataset.theme = 'dark'; }
    })();
  `;

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        {/* 霞鹜文楷 (LXGW WenKai Screen) — used by .prose body. Loaded from CDN
            so we don't ship a 5MB+ webfont in the bundle. preconnect speeds up
            the handshake; the stylesheet itself defines @font-face entries that
            lazy-load WOFF2 subsets only when characters are actually used. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
