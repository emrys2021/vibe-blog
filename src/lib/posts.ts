import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type {
  CategoryBucket,
  Post,
  PostFrontmatter,
  PostMeta,
  TagBucket,
} from './types';
import {
  canonicalizeCategoryPath,
  getCanonicalCategoryPrefixes,
  getCanonicalCategorySegments,
  getDisplayCategoryPrefixes,
  normalizeCategoryPath,
} from './categories';
import { extractToc, renderMarkdown } from './markdown';

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'posts');

/**
 * Walk content/posts and return every entry that looks like a post.
 *
 * Two layouts are supported (mix freely):
 *   content/posts/<slug>.md
 *   content/posts/<slug>/index.md   ← lets a post carry its own assets
 */
function collectMarkdownFiles(): { slug: string; absPath: string }[] {
  if (!fs.existsSync(CONTENT_ROOT)) return [];
  const entries = fs.readdirSync(CONTENT_ROOT, { withFileTypes: true });
  const results: { slug: string; absPath: string }[] = [];

  for (const entry of entries) {
    const entryPath = path.join(CONTENT_ROOT, entry.name);
    if (entry.isDirectory()) {
      const indexPath = path.join(entryPath, 'index.md');
      if (fs.existsSync(indexPath)) {
        results.push({ slug: entry.name, absPath: indexPath });
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push({
        slug: entry.name.replace(/\.md$/, ''),
        absPath: entryPath,
      });
    }
  }
  return results;
}

function parseFrontmatter(raw: string, fallbackTitle: string): { data: PostFrontmatter; content: string } {
  const parsed = matter(raw);
  const fm = parsed.data as Partial<PostFrontmatter>;
  const data: PostFrontmatter = {
    title: fm.title ?? fallbackTitle,
    date: fm.date ? new Date(fm.date).toISOString() : new Date().toISOString(),
    description: fm.description,
    category: typeof fm.category === 'string'
      ? normalizeCategoryPath(fm.category)
      : undefined,
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    draft: Boolean(fm.draft),
    cover: fm.cover,
  };
  return { data, content: parsed.content };
}

function toMeta(slug: string, raw: string): PostMeta {
  const { data, content } = parseFrontmatter(raw, slug);
  const stats = readingTime(content);
  return {
    ...data,
    slug,
    readingTime: stats.text,
    wordCount: stats.words,
  };
}

/**
 * Cached only in production (build-time SSG scans this once).
 * In development we re-scan every call so newly-added markdown files
 * appear without a server restart.
 */
let postsCache: PostMeta[] | null = null;

export function getAllPosts(): PostMeta[] {
  if (postsCache && process.env.NODE_ENV === 'production') return postsCache;
  const files = collectMarkdownFiles();
  const posts = files
    .map(({ slug, absPath }) => {
      const raw = fs.readFileSync(absPath, 'utf8');
      return toMeta(slug, raw);
    })
    .filter((p) => process.env.NODE_ENV === 'development' || !p.draft)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  postsCache = posts;
  return posts;
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

export async function getPost(slug: string): Promise<Post | null> {
  // Next.js dev mode does NOT URL-decode dynamic route params for us, while
  // prod (via generateStaticParams) matches against the raw string. Decoding
  // unconditionally is safe — already-decoded slugs are unaffected unless they
  // contain a literal '%', which filenames effectively never do.
  const decoded = safeDecode(slug);
  const file = collectMarkdownFiles().find((f) => f.slug === decoded);
  if (!file) return null;
  const raw = fs.readFileSync(file.absPath, 'utf8');
  const meta = toMeta(file.slug, raw);
  const { content } = parseFrontmatter(raw, file.slug);
  const html = await renderMarkdown(content);
  const toc = extractToc(content);
  return { ...meta, raw: content, html, toc };
}

export function getAdjacentPosts(slug: string): { prev: PostMeta | null; next: PostMeta | null } {
  const posts = getAllPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  // posts are sorted desc by date; "next" = newer (lower idx), "prev" = older (higher idx)
  return {
    next: idx > 0 ? posts[idx - 1] : null,
    prev: idx < posts.length - 1 ? posts[idx + 1] : null,
  };
}

export function getAllTags(): TagBucket[] {
  const map = new Map<string, PostMeta[]>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags ?? []) {
      const key = tag.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
  }
  return [...map.entries()]
    .map(([tag, posts]) => ({ tag, count: posts.length, posts }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function getPostsByTag(tag: string): PostMeta[] {
  const lower = safeDecode(tag).toLowerCase();
  return getAllPosts().filter((p) =>
    (p.tags ?? []).some((t) => t.toLowerCase() === lower),
  );
}

export function getAllCategories(): CategoryBucket[] {
  const map = new Map<string, { label: string; segments: string[]; posts: PostMeta[] }>();
  for (const post of getAllPosts()) {
    if (!post.category) continue;
    const keys = getCanonicalCategoryPrefixes(post.category);
    const labels = getDisplayCategoryPrefixes(post.category);

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const label = labels[index];
      if (!map.has(key)) {
        map.set(key, {
          label,
          segments: getCanonicalCategorySegments(label),
          posts: [],
        });
      }
      map.get(key)!.posts.push(post);
    }
  }
  return [...map.entries()]
    .map(([category, bucket]) => ({
      category,
      label: bucket.label,
      segments: bucket.segments,
      count: bucket.posts.length,
      posts: bucket.posts,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function getCategoryBucket(category: string | string[]): CategoryBucket | null {
  const canonical = canonicalizeCategoryPath(category);
  if (!canonical) return null;
  return getAllCategories().find((bucket) => bucket.category === canonical) ?? null;
}

export function getPostsByCategory(category: string | string[]): PostMeta[] {
  const canonical = canonicalizeCategoryPath(category);
  if (!canonical) return [];
  return getAllPosts().filter((post) => {
    const postCategory = canonicalizeCategoryPath(post.category);
    return postCategory === canonical || postCategory?.startsWith(`${canonical}/`);
  });
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function groupByYear(posts: PostMeta[]): { year: number; posts: PostMeta[] }[] {
  const map = new Map<number, PostMeta[]>();
  for (const p of posts) {
    const y = new Date(p.date).getFullYear();
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(p);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, posts]) => ({ year, posts }));
}
