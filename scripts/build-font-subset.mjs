#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.cache', 'fonts');
const SOURCE_FONT_PATH = path.join(CACHE_DIR, 'LXGWWenKaiScreen-v1.521.ttf');
const CHARSET_PATH = path.join(CACHE_DIR, 'lxgw-wenkai-site-chars.txt');
const OUTPUT_FONT_PATH = path.join(
  ROOT,
  'src',
  'app',
  'fonts',
  'lxgw-wenkai-subset.woff2',
);
const OUTPUT_META_PATH = path.join(
  ROOT,
  'src',
  'app',
  'fonts',
  'lxgw-wenkai-subset.meta.json',
);
const DEFAULT_SOURCE_URL =
  'https://github.com/lxgw/LxgwWenKai-Screen/releases/download/v1.521/LXGWWenKaiScreen.ttf';
const FONT_SOURCE_VERSION = 'v1.521';
const SUBSET_OPTIONS = [
  '--flavor=woff2',
  '--layout-features=*',
  '--glyph-names',
  '--symbol-cmap',
  '--legacy-cmap',
  '--notdef-glyph',
  '--notdef-outline',
  '--recommended-glyphs',
];
const TEXT_SOURCES = [
  path.join(ROOT, 'content', 'posts'),
  path.join(ROOT, 'src'),
  path.join(ROOT, 'blog.config.ts'),
];
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.json',
  '.md',
  '.mdx',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
]);
const ALWAYS_INCLUDE =
  ' \n\t0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '.,:;!?-_=+*/%()[]{}<>@#&\'"`~|\\' +
  '，。！？：；（）【】《》“”‘’、…—·￥';

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_FONT_PATH), { recursive: true });

  const chars = collectSiteCharacters();
  fs.writeFileSync(CHARSET_PATH, chars, 'utf8');
  const subsetHash = createSubsetHash(chars);
  const currentMeta = readSubsetMeta();

  if (
    currentMeta?.hash === subsetHash &&
    fs.existsSync(OUTPUT_FONT_PATH)
  ) {
    const stats = fs.statSync(OUTPUT_FONT_PATH);
    console.log(
      `font:subset skipped ${path.relative(ROOT, OUTPUT_FONT_PATH)} (${Math.round(stats.size / 1024)} KB, unchanged)`,
    );
    return;
  }

  const sourceFontPath = process.env.LXGW_WENKAI_SOURCE_FONT || SOURCE_FONT_PATH;
  if (!fs.existsSync(sourceFontPath)) {
    await downloadSourceFont(sourceFontPath, process.env.LXGW_WENKAI_SOURCE_URL || DEFAULT_SOURCE_URL);
  }

  const pyftsubset = resolvePyftsubsetBinary();
  const result = spawnSync(
    pyftsubset,
    [
      sourceFontPath,
      `--text-file=${CHARSET_PATH}`,
      `--output-file=${OUTPUT_FONT_PATH}`,
      ...SUBSET_OPTIONS,
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      shell: false,
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const stats = fs.statSync(OUTPUT_FONT_PATH);
  fs.writeFileSync(
    OUTPUT_META_PATH,
    `${JSON.stringify(
      {
        hash: subsetHash,
        fontSourceVersion: FONT_SOURCE_VERSION,
        generatedAt: new Date().toISOString(),
        charCount: chars.length,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(
    `font:subset wrote ${path.relative(ROOT, OUTPUT_FONT_PATH)} (${Math.round(stats.size / 1024)} KB)`,
  );
}

function collectSiteCharacters() {
  const chars = new Set(ALWAYS_INCLUDE.split(''));

  for (const source of TEXT_SOURCES) {
    if (!fs.existsSync(source)) continue;
    walkTextFiles(source, (text) => {
      for (const char of text) {
        if (shouldKeepChar(char)) {
          chars.add(char);
        }
      }
    });
  }

  return [...chars].join('');
}

function walkTextFiles(targetPath, onText) {
  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      walkTextFiles(path.join(targetPath, entry.name), onText);
    }
    return;
  }

  if (!TEXT_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
    return;
  }

  onText(fs.readFileSync(targetPath, 'utf8'));
}

function shouldKeepChar(char) {
  const code = char.codePointAt(0) ?? 0;
  return (
    char === '\n' ||
    char === '\t' ||
    (code >= 0x20 && code !== 0x7f)
  );
}

function createSubsetHash(chars) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        chars,
        fontSourceVersion: FONT_SOURCE_VERSION,
        options: SUBSET_OPTIONS,
      }),
    )
    .digest('hex');
}

function readSubsetMeta() {
  if (!fs.existsSync(OUTPUT_META_PATH)) return null;

  try {
    return JSON.parse(fs.readFileSync(OUTPUT_META_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function resolvePyftsubsetBinary() {
  const candidates = [
    process.env.PYFTSUBSET_BIN,
    path.join(ROOT, '.venv', 'Scripts', 'pyftsubset.exe'),
    path.join(ROOT, '.venv', 'Scripts', 'pyftsubset'),
    'pyftsubset',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const exists = candidate === 'pyftsubset' || fs.existsSync(candidate);
    if (exists) {
      return candidate;
    }
  }

  console.error(
    'font:subset could not find pyftsubset. Install fonttools, or set PYFTSUBSET_BIN.',
  );
  process.exit(1);
}

async function downloadSourceFont(targetPath, url) {
  console.log(`font:subset downloading source font from ${url}`);

  const response = await fetch(url, {
    headers: {
      'user-agent': 'proj-blog/font-subset-script',
    },
  });

  if (!response.ok) {
    throw new Error(`font:subset failed to download source font (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
