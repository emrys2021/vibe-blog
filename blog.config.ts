/**
 * Site-wide configuration.
 * Edit this file to brand the blog.
 */
export const siteConfig = {
  name: '~/blog',
  title: 'proj-blog',
  description: 'A geek-flavored personal blog. Plain markdown, zero ceremony.',
  url: 'https://example.com',
  author: {
    name: 'JKL',
    handle: '@jkl',
    email: 'hi@example.com',
    bio: 'engineer / writes code, occasionally writes about it.',
  },
  nav: [
    { href: '/', label: 'home' },
    { href: '/archive', label: 'archive' },
    { href: '/tags', label: 'tags' },
    { href: '/about', label: 'about' },
  ],
  social: [
    { label: 'github', href: 'https://github.com/' },
    { label: 'rss', href: '/rss.xml' },
  ],
  postsPerPage: 10,
} as const;

export type SiteConfig = typeof siteConfig;
