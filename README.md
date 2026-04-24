# proj-blog

A geek-flavored, file-system-driven personal blog. Drop a markdown file into `content/posts/`, run `next build`, ship a static site.

## Highlights

- `Ctrl/Cmd + K` command palette for post search, page jumps, theme actions, and section navigation
- Obsidian-friendly bundled posts with `attachments/` synced to `public/post-assets/`
- Article UX touches: reading progress bar, heading permalinks, code copy buttons, and image lightbox
- Self-hosted, subsetted 霞鹜文楷 with preload to reduce first-paint font swaps
- File-system-driven content model with categories, tags, RSS, and sitemap generation

## Stack

- **Next.js 15** (App Router, RSC, fully static output)
- **TypeScript** strict
- **Tailwind CSS v4**
- **remark / rehype** + **shiki** for markdown rendering and code highlighting
- **Obsidian-friendly bundled posts** with static asset syncing
- **kbar** for command palette interactions
- **next/font/local** for self-hosted WenKai preload
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
    attachments/
      diagram.png
```

Bundled posts are synced into `public/post-assets/` before `dev`, `build`, and `start`. If you add or rename attachments while `next dev` is already running, rerun `npm run sync:assets` or restart the dev server.

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
├── scripts/              # post scaffolding + bundled asset sync
└── src/
    ├── app/              # routes (home / posts / tags / archive / about / rss / sitemap)
    ├── components/       # Header, command palette, post enhancements, TOC, cards
    └── lib/              # posts scanner, markdown renderer, command menu data, theme utils
```

## Customizing

- **Branding & nav** → `blog.config.ts`
- **Colors / fonts** → CSS custom properties in `src/app/globals.css` (`@theme` block)
- **Markdown pipeline** → `src/lib/markdown.ts` (add remark/rehype plugins here)
- **Bundled post asset sync** → `scripts/sync-post-assets.mjs`
- **WenKai subset rebuild** → `npm run font:subset`
  Requires `pyftsubset` from `fonttools` (for example inside `.venv`) and will auto-download the upstream `LXGWWenKaiScreen.ttf` source font into `.cache/fonts/` when missing.

## Deploying

The output is fully static — any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages, plain S3). On Vercel: connect the repo and you're done. Elsewhere, `next build` then serve `.next/` with `next start`, or add `output: 'export'` to `next.config.mjs` for `out/`.

## License

MIT.
