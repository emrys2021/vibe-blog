#!/usr/bin/env node
/**
 * Scaffold a new post.
 *   npm run new -- "My Post Title"
 *   npm run new -- "My Post Title" --bundle   # creates folder + index.md + attachments/
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('--')) {
  console.error('usage: npm run new -- "Post Title" [--bundle]');
  process.exit(1);
}
const title = args[0];
const bundle = args.includes('--bundle');

const slug = title
  .toLowerCase()
  .trim()
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '');

if (!slug) {
  console.error('!  could not derive a slug from the title');
  process.exit(1);
}

const root = path.join(process.cwd(), 'content', 'posts');
fs.mkdirSync(root, { recursive: true });

const target = bundle
  ? path.join(root, slug, 'index.md')
  : path.join(root, `${slug}.md`);

if (fs.existsSync(target)) {
  console.error(`!  already exists: ${path.relative(process.cwd(), target)}`);
  process.exit(1);
}

if (bundle) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.mkdirSync(path.join(path.dirname(target), 'attachments'), { recursive: true });
}

const today = new Date().toISOString().slice(0, 10);
const body = `---
title: "${title.replace(/"/g, '\\"')}"
date: "${today}"
description: ""
tags: []
draft: true
---

write here.
`;

fs.writeFileSync(target, body, 'utf8');
console.log(`✓  ${path.relative(process.cwd(), target)}`);
