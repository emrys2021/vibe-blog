import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type {
  CategoryBucket,
  CommandMenuPost,
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
import { getPostHref } from './post-urls';

const CONTENT_ROOT = path.resolve(
  process.env.BLOG_CONTENT_ROOT ?? path.join(process.cwd(), 'content', 'posts'),
);
const IGNORED_CONTENT_DIRS = new Set([
  '.git',
  '.obsidian',
  '.trash',
  'node_modules',
  'attachments',
]);
const MARKDOWN_SOURCE_RE = /\.(md|mdx|markdown)$/i;
const INDEX_SOURCE_RE = /^index\.(md|mdx|markdown)$/i;

interface MarkdownSource {
  slug: string;
  absPath: string;
  postDir: string;
  title: string;
  category?: string;
}

interface RenderedPostCacheEntry {
  mtimeMs: number;
  post: Post;
}

/**
 * Walk the content root and return every entry that looks like a post.
 *
 * Supported layouts (mix freely):
 *   content/posts/<slug>.md
 *   content/posts/<slug>/index.md
 *   content/posts/<category>/<post>.md
 *
 * Set BLOG_CONTENT_ROOT to an Obsidian vault root to publish the vault
 * directly. Obsidian metadata folders and sibling attachments folders are
 * ignored as posts, while sibling attachments remain available to Markdown.
 */
function collectMarkdownFiles(): MarkdownSource[] {
  if (!fs.existsSync(CONTENT_ROOT)) return [];

  const results: MarkdownSource[] = [];
  walkContentDir(CONTENT_ROOT, results);
  return results.sort((a, b) => a.slug.localeCompare(b.slug));
}

function walkContentDir(dir: string, results: MarkdownSource[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_CONTENT_DIRS.has(entry.name)) {
        walkContentDir(entryPath, results);
      }
      continue;
    }

    if (!entry.isFile() || !MARKDOWN_SOURCE_RE.test(entry.name)) {
      continue;
    }

    const source = createMarkdownSource(entryPath);
    if (source) results.push(source);
  }
}

function createMarkdownSource(absPath: string): MarkdownSource | null {
  const relativePath = toPosixPath(path.relative(CONTENT_ROOT, absPath));
  if (!relativePath || relativePath.startsWith('..')) return null;

  const parsed = path.posix.parse(relativePath);
  const isIndex = INDEX_SOURCE_RE.test(parsed.base);
  const slug = isIndex ? parsed.dir : path.posix.join(parsed.dir, parsed.name);
  if (!slug) return null;

  const category = isIndex ? path.posix.dirname(parsed.dir) : parsed.dir;
  const normalizedCategory = category && category !== '.'
    ? normalizeCategoryPath(category)
    : undefined;

  return {
    slug,
    absPath,
    postDir: path.dirname(absPath),
    title: isIndex ? path.posix.basename(parsed.dir) : parsed.name,
    category: normalizedCategory,
  };
}

function parseFrontmatter(
  raw: string,
  fallbackTitle: string,
  fallbackDate: string,
  fallbackCategory?: string,
): { data: PostFrontmatter; content: string } {
  const parsed = parseMatterSafely(raw);
  const fm = isRecord(parsed.data) ? parsed.data as Partial<PostFrontmatter> : {};
  const data: PostFrontmatter = {
    title: fm.title ?? fallbackTitle,
    date: fm.date ? new Date(fm.date).toISOString() : fallbackDate,
    description: fm.description,
    category: typeof fm.category === 'string'
      ? normalizeCategoryPath(fm.category)
      : fallbackCategory,
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    draft: Boolean(fm.draft),
    cover: fm.cover,
  };
  return { data, content: parsed.content };
}


function parseMatterSafely(raw: string): { data: unknown; content: string } {
  try {
    return matter(raw);
  } catch {
    return { data: {}, content: stripLeadingFrontmatter(raw) };
  }
}

function stripLeadingFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw;

  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
  return match ? raw.slice(match[0].length) : raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function toMeta(source: MarkdownSource, raw: string): PostMeta {
  const fallbackDate = new Date(getSourceMtimeMs(source.absPath)).toISOString();
  const { data, content } = parseFrontmatter(
    raw,
    source.title,
    fallbackDate,
    source.category,
  );
  const stats = readingTime(content);
  return {
    ...data,
    slug: source.slug,
    readingTime: stats.text,
    wordCount: stats.words,
  };
}

let postsCache: PostMeta[] | null = null;
let searchDocumentsCache: CommandMenuPost[] | null = null;
const renderedPostCache = new Map<string, RenderedPostCacheEntry>();

export function getAllPosts(): PostMeta[] {
  if (postsCache && process.env.NODE_ENV === 'production') return postsCache;
  const posts = collectMarkdownFiles()
    .map((source) => {
      const raw = fs.readFileSync(source.absPath, 'utf8');
      return toMeta(source, raw);
    })
    .filter((p) => process.env.NODE_ENV === 'development' || !p.draft)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  postsCache = posts;
  return posts;
}

export function getSearchDocuments(): CommandMenuPost[] {
  if (searchDocumentsCache && process.env.NODE_ENV === 'production') {
    return searchDocumentsCache;
  }

  const documents = collectMarkdownFiles()
    .map((source) => {
      const raw = fs.readFileSync(source.absPath, 'utf8');
      const meta = toMeta(source, raw);
      const { content } = parseFrontmatter(raw, source.title, meta.date, source.category);

      return {
        draft: Boolean(meta.draft),
        document: {
          slug: meta.slug,
          title: meta.title,
          description: meta.description,
          category: meta.category,
          tags: meta.tags ?? [],
          searchText: normalizeSearchText([
            meta.title,
            meta.description,
            meta.category,
            ...(meta.tags ?? []),
            content,
          ].filter(Boolean).join('\n')),
        },
      };
    })
    .filter((entry) => process.env.NODE_ENV === 'development' || !entry.draft)
    .map((entry) => entry.document);

  searchDocumentsCache = documents;
  return documents;
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

export function getPostMeta(slug: string): PostMeta | null {
  const file = findMarkdownSource(slug);
  if (!file) return null;

  const cached = getCachedRenderedPost(file);
  if (cached) {
    return cached;
  }

  const raw = fs.readFileSync(file.absPath, 'utf8');
  return toMeta(file, raw);
}

export async function getPost(slug: string): Promise<Post | null> {
  const file = findMarkdownSource(slug);
  if (!file) return null;

  const cached = getCachedRenderedPost(file);
  if (cached) return cached;

  const raw = fs.readFileSync(file.absPath, 'utf8');
  const meta = toMeta(file, raw);
  const { content } = parseFrontmatter(raw, file.title, meta.date, file.category);
  const html = await renderMarkdown(content, {
    slug: file.slug,
    postDir: file.postDir,
    resolveObsidianLink: (target) => resolveObsidianPostHref(target, file),
  });
  const toc = extractToc(content);
  const post = { ...meta, raw: content, html, toc };
  renderedPostCache.set(file.absPath, {
    mtimeMs: getSourceMtimeMs(file.absPath),
    post,
  });
  return post;
}

export function getAdjacentPosts(slug: string): { prev: PostMeta | null; next: PostMeta | null } {
  const posts = getAllPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
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

function findMarkdownSource(slug: string): MarkdownSource | null {
  const decoded = safeDecode(slug);
  return collectMarkdownFiles().find((file) => file.slug === decoded) ?? null;
}

function getCachedRenderedPost(file: MarkdownSource): Post | null {
  const cached = renderedPostCache.get(file.absPath);
  if (!cached) return null;
  if (cached.mtimeMs !== getSourceMtimeMs(file.absPath)) return null;
  return cached.post;
}

function getSourceMtimeMs(absPath: string): number {
  return fs.statSync(absPath).mtimeMs;
}

function normalizeSearchText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, ' $1 ')
    .replace(/!\[\[[^\]]+\]\]/g, ' ')
    .replace(/\[\[([^\]|]+)\|?([^\]]+)?\]\]/g, ' $1 $2 ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function resolveObsidianPostHref(target: string, currentSource: MarkdownSource): string | null {
  const normalized = normalizeObsidianPostTarget(target);
  if (!normalized) return null;

  const sources = collectMarkdownFiles();
  const currentDir = toPosixPath(path.relative(CONTENT_ROOT, currentSource.postDir));
  const relativeCandidates = [
    path.posix.normalize(path.posix.join(currentDir, normalized)),
    normalized,
  ];

  for (const candidate of relativeCandidates) {
    const withoutExtension = candidate.replace(MARKDOWN_SOURCE_RE, '');
    const exact = sources.find((source) => source.slug === withoutExtension);
    if (exact) return getPostHref(exact.slug);
  }

  const basename = path.posix.basename(normalized).replace(MARKDOWN_SOURCE_RE, '');
  const byBasename = sources.filter((source) => path.posix.basename(source.slug) === basename);
  if (byBasename.length === 1) {
    return getPostHref(byBasename[0].slug);
  }

  return null;
}

function normalizeObsidianPostTarget(target: string): string | null {
  const stripped = target
    .split('#')[0]
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/\\/g, '/');

  if (!stripped) return null;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#|\?)/i.test(stripped)) {
    return null;
  }

  const normalized = path.posix.normalize(stripped).replace(/^\.\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../')) {
    return null;
  }

  return normalized;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}



