# proj-blog

A geek-flavored, file-system-driven personal blog. Drop a markdown file into `content/posts/`, run `next build`, ship a static site.

## Stack

- **Next.js 15** (App Router, RSC, fully static output)
- **TypeScript** strict
- **Tailwind CSS v4**
- **remark / rehype** + **shiki** for markdown rendering and code highlighting
- **gray-matter** for frontmatter

## Quickstart

```bash
$ npm install
$ npm run dev          # http://localhost:3000
$ npm run new -- "My first post"
$ npm run build && npm start
```

## Content layout

Two layouts, mix freely:

```
content/posts/
  single-file-post.md
  bundled-post/
    index.md
    diagram.png
```

Frontmatter:

```yaml
---
title: "Required"
date: "2026-04-22"
description: "Optional"
tags: ["optional"]
draft: false
---
```

## Project layout

```
.
├── blog.config.ts        # site name, author, nav, social
├── content/posts/        # ← write here
├── scripts/new-post.mjs  # `npm run new`
└── src/
    ├── app/              # routes (home / posts / tags / archive / about / rss / sitemap)
    ├── components/       # Header, Footer, PostCard, Toc, ThemeToggle, Prompt
    └── lib/              # posts.ts (scanner), markdown.ts (renderer), types, format
```

## Customizing

- **Branding & nav** → `blog.config.ts`
- **Colors / fonts** → CSS custom properties in `src/app/globals.css` (`@theme` block)
- **Markdown pipeline** → `src/lib/markdown.ts` (add remark/rehype plugins here)

## Deploying

The output is fully static — any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages, plain S3). On Vercel: connect the repo and you're done. Elsewhere, `next build` then serve `.next/` with `next start`, or add `output: 'export'` to `next.config.mjs` for `out/`.

## License

MIT.
