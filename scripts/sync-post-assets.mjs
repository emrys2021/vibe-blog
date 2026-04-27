#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_ROOT = path.resolve(
  process.env.BLOG_CONTENT_ROOT ?? path.join(process.cwd(), 'content', 'posts'),
);
const OUTPUT_ROOT = path.join(process.cwd(), 'public', 'post-assets');
const MARKDOWN_SOURCE_RE = /\.(md|mdx|markdown)$/i;
const INDEX_SOURCE_RE = /^index\.(md|mdx|markdown)$/i;
const IGNORED_CONTENT_DIRS = new Set([
  '.git',
  '.obsidian',
  '.trash',
  'node_modules',
  'attachments',
]);

function syncPostAssets() {
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  if (!fs.existsSync(CONTENT_ROOT)) {
    console.log(`sync:assets no content directory found at ${CONTENT_ROOT}`);
    return;
  }

  let postCount = 0;
  let assetCount = 0;

  for (const source of collectMarkdownFiles()) {
    const copied = copyAssetTree(source.postDir, path.join(OUTPUT_ROOT, ...source.slug.split('/')));
    if (copied > 0) {
      postCount += 1;
      assetCount += copied;
    }
  }

  if (assetCount === 0) {
    console.log('sync:assets no bundled post assets to copy');
    return;
  }

  console.log(
    `sync:assets copied ${assetCount} asset${assetCount === 1 ? '' : 's'} across ${postCount} post${postCount === 1 ? '' : 's'}`,
  );
}

function collectMarkdownFiles() {
  const results = [];
  walkContentDir(CONTENT_ROOT, results);
  return results;
}

function walkContentDir(dir, results) {
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

function createMarkdownSource(absPath) {
  const relativePath = toPosixPath(path.relative(CONTENT_ROOT, absPath));
  if (!relativePath || relativePath.startsWith('..')) return null;

  const parsed = path.posix.parse(relativePath);
  const slug = INDEX_SOURCE_RE.test(parsed.base)
    ? parsed.dir
    : path.posix.join(parsed.dir, parsed.name);

  if (!slug) return null;
  return { slug, postDir: path.dirname(absPath) };
}

function copyAssetTree(sourceDir, targetDir, relative = '') {
  const currentSourceDir = relative ? path.join(sourceDir, relative) : sourceDir;
  let copied = 0;

  for (const entry of fs.readdirSync(currentSourceDir, { withFileTypes: true })) {
    const nextRelative = relative ? path.join(relative, entry.name) : entry.name;
    const sourcePath = path.join(sourceDir, nextRelative);

    if (entry.isDirectory()) {
      if (IGNORED_CONTENT_DIRS.has(entry.name) && entry.name !== 'attachments') {
        continue;
      }
      copied += copyAssetTree(sourceDir, targetDir, nextRelative);
      continue;
    }

    if (MARKDOWN_SOURCE_RE.test(entry.name)) {
      continue;
    }

    const targetPath = path.join(targetDir, nextRelative);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    copied += 1;
  }

  return copied;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

syncPostAssets();
