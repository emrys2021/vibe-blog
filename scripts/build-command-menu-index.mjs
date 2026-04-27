#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = process.cwd();
const CONTENT_ROOT = path.resolve(
  process.env.BLOG_CONTENT_ROOT ?? path.join(ROOT, 'content', 'posts'),
);
const OUTPUT_PATH = path.join(ROOT, 'public', 'command-menu-index.json');
const FULLTEXT_OUTPUT_PATH = path.join(
  ROOT,
  'public',
  'command-menu-fulltext-index.json',
);
const INCLUDE_DRAFTS = process.argv.includes('--include-drafts');
const MARKDOWN_SOURCE_RE = /\\.(md|mdx|markdown)$/i;
const INDEX_SOURCE_RE = /^index\\.(md|mdx|markdown)$/i;
const IGNORED_CONTENT_DIRS = new Set([
  '.git',
  '.obsidian',
  '.trash',
  'node_modules',
  'attachments',
]);

function collectMarkdownFiles() {
  if (!fs.existsSync(CONTENT_ROOT)) return [];

  const entries = fs.readdirSync(CONTENT_ROOT, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(CONTENT_ROOT, entry.name);
    if (entry.isDirectory()) {
      const indexPath = path.join(entryPath, 'index.md');
      if (fs.existsSync(indexPath)) {
        results.push({
          slug: entry.name,
          absPath: indexPath,
        });
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

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitCategoryPath(value) {
  return (value?.split('/') ?? [])
    .map((segment) => safeDecode(segment).trim())
    .filter(Boolean);
}

function normalizeCategoryPath(value) {
  const segments = splitCategoryPath(value);
  return segments.length > 0 ? segments.join('/') : undefined;
}

function getCanonicalCategorySegments(value) {
  return splitCategoryPath(value).map((segment) => segment.toLowerCase());
}

function getCanonicalCategoryPrefixes(value) {
  const segments = getCanonicalCategorySegments(value);
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

function getDisplayCategoryPrefixes(value) {
  const segments = splitCategoryPath(value);
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

function parseFrontmatter(raw, fallbackTitle, fallbackCategory) {
  const parsed = parseMatterSafely(raw);
  const fm = isRecord(parsed.data) ? parsed.data : {};

  return {
    data: {
      title: typeof fm.title === 'string' ? fm.title : fallbackTitle,
      description: typeof fm.description === 'string' ? fm.description : undefined,
      category:
        typeof fm.category === 'string'
          ? normalizeCategoryPath(fm.category)
          : fallbackCategory,
      tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
      draft: Boolean(fm.draft),
    },
    content: parsed.content,
  };
}


function parseMatterSafely(raw) {
  try {
    return matter(raw);
  } catch {
    return { data: {}, content: stripLeadingFrontmatter(raw) };
  }
}

function stripLeadingFrontmatter(raw) {
  if (!raw.startsWith('---')) return raw;

  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
  return match ? raw.slice(match[0].length) : raw;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function normalizeSearchText(raw) {
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

function buildCommandMenuData() {
  const postEntries = collectMarkdownFiles()
    .map((source) => {
      const raw = fs.readFileSync(source.absPath, 'utf8');
      const { data, content } = parseFrontmatter(raw, source.title, source.category);
      const { slug } = source;

      return {
        draft: data.draft,
        slug,
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags ?? [],
        lightSearchText: normalizeSearchText(
          [data.title, data.description, data.category, ...(data.tags ?? [])]
            .filter(Boolean)
            .join('\n'),
        ),
        fullSearchText: normalizeSearchText(
          [data.title, data.description, data.category, ...(data.tags ?? []), content]
            .filter(Boolean)
            .join('\n'),
        ),
      };
    })
    .filter((entry) => INCLUDE_DRAFTS || !entry.draft);

  const tagsMap = new Map();
  for (const post of postEntries) {
    for (const tag of post.tags) {
      const key = tag.toLowerCase();
      tagsMap.set(key, (tagsMap.get(key) ?? 0) + 1);
    }
  }

  const categoriesMap = new Map();
  for (const post of postEntries) {
    if (!post.category) continue;

    const keys = getCanonicalCategoryPrefixes(post.category);
    const labels = getDisplayCategoryPrefixes(post.category);

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const label = labels[index];
      const current = categoriesMap.get(key) ?? { category: key, label, count: 0 };
      current.count += 1;
      categoriesMap.set(key, current);
    }
  }

  return {
    light: {
      posts: postEntries.map(
        ({ draft, fullSearchText, lightSearchText, ...post }) => ({
          ...post,
          searchText: lightSearchText,
        }),
      ),
      tags: [...tagsMap.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      categories: [...categoriesMap.values()].sort((a, b) =>
        a.category.localeCompare(b.category),
      ),
    },
    fullText: {
      posts: postEntries.map(({ slug, fullSearchText }) => ({
        slug,
        searchText: fullSearchText,
      })),
    },
  };
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function main() {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  const data = buildCommandMenuData();
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(data.light)}\n`, 'utf8');
  fs.writeFileSync(
    FULLTEXT_OUTPUT_PATH,
    `${JSON.stringify(data.fullText)}\n`,
    'utf8',
  );

  console.log(
    `command-menu:index wrote ${path.relative(ROOT, OUTPUT_PATH)} (${data.light.posts.length} posts)`,
  );
  console.log(
    `command-menu:index wrote ${path.relative(ROOT, FULLTEXT_OUTPUT_PATH)} (${data.fullText.posts.length} posts)`,
  );
}

main();



