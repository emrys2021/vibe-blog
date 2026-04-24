import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { jetbrainsMono, wenkai } from './fonts';
import { CommandMenuRoot } from '@/components/CommandMenuRoot';
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
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${jetbrainsMono.variable} ${wenkai.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
        <CommandMenuRoot />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
