#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'posts');
const OUTPUT_ROOT = path.join(process.cwd(), 'public', 'post-assets');
const MARKDOWN_SOURCE_RE = /\.(md|mdx|markdown)$/i;

function syncPostAssets() {
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  if (!fs.existsSync(CONTENT_ROOT)) {
    console.log('sync:assets no content/posts directory found');
    return;
  }

  let postCount = 0;
  let assetCount = 0;

  for (const entry of fs.readdirSync(CONTENT_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const sourceDir = path.join(CONTENT_ROOT, entry.name);
    const indexPath = path.join(sourceDir, 'index.md');
    if (!fs.existsSync(indexPath)) continue;

    const copied = copyAssetTree(sourceDir, path.join(OUTPUT_ROOT, entry.name));
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
    `sync:assets copied ${assetCount} asset${assetCount === 1 ? '' : 's'} across ${postCount} bundled post${postCount === 1 ? '' : 's'}`,
  );
}

function copyAssetTree(sourceDir, targetDir, relative = '') {
  const currentSourceDir = relative ? path.join(sourceDir, relative) : sourceDir;
  let copied = 0;

  for (const entry of fs.readdirSync(currentSourceDir, { withFileTypes: true })) {
    const nextRelative = relative ? path.join(relative, entry.name) : entry.name;
    const sourcePath = path.join(sourceDir, nextRelative);

    if (entry.isDirectory()) {
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

syncPostAssets();
