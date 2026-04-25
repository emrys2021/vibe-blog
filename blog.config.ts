/**
 * Site-wide configuration.
 * Edit this file to brand the blog.
 */
export const siteConfig = {
  name: "~/blog",
  title: "proj-blog",
  description: "A geek-flavored personal blog. Plain markdown, zero ceremony.",
  url: "https://example.com",
  language: "zh-CN",
  author: {
    name: "JKL",
    handle: "@jkl",
    email: "pheonix_jk@hotmail.com",
    bio: "vibe coding blog",
  },
  nav: [
    { href: "/", label: "home" },
    { href: "/archive", label: "archive" },
    { href: "/categories", label: "categories" },
    { href: "/tags", label: "tags" },
    { href: "/about", label: "about" },
  ],
  social: [
    { label: "github", href: "https://github.com/emrys2021" },
    { label: "rss", href: "/rss.xml" },
  ],
  postsPerPage: 10,
} as const;

export type SiteConfig = typeof siteConfig;
