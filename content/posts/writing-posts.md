---
title: "How to write posts"
date: "2026-04-21"
description: "Two file layouts, one frontmatter spec, zero ceremony."
tags: ["meta", "guide"]
---

There are two ways to add a post — pick whichever fits the post.

## Single file

For text-only posts, drop a `.md` file directly in `content/posts/`:

```
content/posts/
  my-quick-thought.md
```

The slug is the filename without the extension.

## Bundled folder

When the post needs assets (images, attachments), give it a folder with an `index.md`:

```
content/posts/
  my-illustrated-essay/
    index.md
    diagram.png
```

The slug is the folder name. Reference assets with relative paths.

## Frontmatter

Every post starts with YAML frontmatter:

```yaml
---
title: "The post title"
date: "2026-04-22"
description: "Optional one-liner shown in lists and meta tags."
tags: ["one", "two"]
draft: false
---
```

Only `title` is strictly required — everything else has sensible defaults. `draft: true` posts are visible in `next dev` but hidden in `next build`.

## Scaffold one quickly

```bash
$ npm run new -- "My next post"
$ npm run new -- "An illustrated post" --bundle
```
