---
title: "Hello, World"
date: "2026-04-22"
description: "The obligatory first post — a tour of what this blog can do."
tags: ["meta", "intro"]
---

This is the first post. If you can read it, the scanner found `content/posts/hello-world/index.md` and turned it into a route.

## What this engine does

Drop a markdown file (or a folder containing `index.md`) into `content/posts/`, and at build time it becomes:

- a route at `/posts/<slug>`
- an entry on the home page
- an entry in `/archive`
- a contributor to any `tags` it declares

No database. No CMS. No build step beyond `next build`.

## A taste of formatting

GitHub-flavored markdown is supported out of the box:

> A quoted line, like a proverb pinned above the desk.

| col | description |
| --- | ----------- |
| `#` | h1 (title)  |
| `##` | h2         |
| `*`  | italic     |

### Code, with syntax highlighting

```ts title="example.ts"
type Post = {
  slug: string;
  title: string;
  date: string;
};

export const recent = (posts: Post[]) =>
  posts.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5);
```

```bash
$ npm run dev
```

### Lists

1. step one
2. step two
3. profit

- a
- b
- c

That's all. Edit `blog.config.ts` to brand the site, then write something better than this.
