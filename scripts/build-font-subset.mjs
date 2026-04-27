#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.cache', 'fonts');
const SUBSET_OPTIONS = [
  '--flavor=woff',
  '--layout-features=*',
  '--glyph-names',
  '--symbol-cmap',
  '--legacy-cmap',
  '--notdef-glyph',
  '--notdef-outline',
  '--recommended-glyphs',
];
const CONTENT_ROOT = path.resolve(
  process.env.BLOG_CONTENT_ROOT ?? path.join(ROOT, 'content', 'posts'),
);
const TEXT_SOURCES = [
  CONTENT_ROOT,
  path.join(ROOT, 'src'),
  path.join(ROOT, 'blog.config.ts'),
];
const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.obsidian',
  '.trash',
  'node_modules',
  'attachments',
]);
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
const TERMINAL_UI_CHARS =
  '─━│┃┄┅┆┇┈┉┊┋┌┍┎┏┐┑┒┓└┕┖┗┘┙┚┛' +
  '├┝┞┟┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯┰┱┲┳┴┵┶┷┸┹┺┻' +
  '┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋╌╍╎╏═║╒╓╔╕╖╗╘╙' +
  '╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬╭╮╯╰╱╲╳╴╵╶╷╸╹' +
  '╺╻╼╽╾╿█▓▒░▄▀▌▐';
const FONT_BUILDS = [
  {
    label: 'WenKai',
    sourceEnv: 'LXGW_WENKAI_SOURCE_FONT',
    sourceUrlEnv: 'LXGW_WENKAI_SOURCE_URL',
    sourcePath: path.join(CACHE_DIR, 'LXGWWenKaiScreen-v1.521.ttf'),
    sourceVersion: 'v1.521',
    defaultSourceUrl:
      'https://github.com/lxgw/LxgwWenKai-Screen/releases/download/v1.521/LXGWWenKaiScreen.ttf',
    charsetPath: path.join(CACHE_DIR, 'lxgw-wenkai-site-chars.txt'),
    outputFontPath: path.join(
      ROOT,
      'src',
      'app',
      'fonts',
      'lxgw-wenkai-subset.woff',
    ),
    outputMetaPath: path.join(
      ROOT,
      'src',
      'app',
      'fonts',
      'lxgw-wenkai-subset.meta.json',
    ),
    alwaysInclude: ALWAYS_INCLUDE,
  },
  {
    label: 'JetBrains Mono',
    sourceEnv: 'JETBRAINS_MONO_SOURCE_FONT',
    sourceUrlEnv: 'JETBRAINS_MONO_SOURCE_URL',
    sourcePath: path.join(CACHE_DIR, 'JetBrainsMono[wght].ttf'),
    sourceVersion: 'v2.304',
    defaultSourceUrl:
      'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/v2.304/fonts/variable/JetBrainsMono%5Bwght%5D.ttf',
    charsetPath: path.join(CACHE_DIR, 'jetbrains-mono-site-chars.txt'),
    outputFontPath: path.join(
      ROOT,
      'src',
      'app',
      'fonts',
      'jetbrains-mono-latin-var.woff2',
    ),
    outputMetaPath: path.join(
      ROOT,
      'src',
      'app',
      'fonts',
      'jetbrains-mono-latin-var.meta.json',
    ),
    alwaysInclude: `${ALWAYS_INCLUDE}${TERMINAL_UI_CHARS}`,
  },
];

async function main() {
  if (process.env.VERCEL === '1' && hasAllOutputFonts()) {
    console.log('font:subset skipped on Vercel; using committed font assets');
    return;
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const pyftsubset = resolvePyftsubsetBinary();

  for (const font of FONT_BUILDS) {
    fs.mkdirSync(path.dirname(font.outputFontPath), { recursive: true });

    const chars = collectSiteCharacters(font.alwaysInclude);
    fs.writeFileSync(font.charsetPath, chars, 'utf8');
    const subsetHash = createSubsetHash(chars, font.sourceVersion);
    const currentMeta = readSubsetMeta(font.outputMetaPath);

    if (currentMeta?.hash === subsetHash && fs.existsSync(font.outputFontPath)) {
      const stats = fs.statSync(font.outputFontPath);
      console.log(
        `font:subset skipped ${path.relative(ROOT, font.outputFontPath)} (${Math.round(stats.size / 1024)} KB, unchanged)`,
      );
      continue;
    }

    const sourceFontPath = process.env[font.sourceEnv] || font.sourcePath;
    if (!fs.existsSync(sourceFontPath)) {
      try {
        await downloadSourceFont(
          sourceFontPath,
          process.env[font.sourceUrlEnv] || font.defaultSourceUrl,
          font.label,
        );
      } catch (error) {
        if (fs.existsSync(font.outputFontPath)) {
          console.warn('font:subset kept existing ' + path.relative(ROOT, font.outputFontPath) + ' because ' + font.label + ' source font is unavailable');
          continue;
        }
        throw error;
      }
    }

    const result = spawnSync(
      pyftsubset,
      [
        sourceFontPath,
        `--text-file=${font.charsetPath}`,
        `--output-file=${font.outputFontPath}`,
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

    const stats = fs.statSync(font.outputFontPath);
    fs.writeFileSync(
      font.outputMetaPath,
      `${JSON.stringify(
        {
          hash: subsetHash,
          fontSourceVersion: font.sourceVersion,
          generatedAt: new Date().toISOString(),
          charCount: chars.length,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(
      `font:subset wrote ${path.relative(ROOT, font.outputFontPath)} (${Math.round(stats.size / 1024)} KB)`,
    );
  }
}


function hasAllOutputFonts() {
  return FONT_BUILDS.every((font) => fs.existsSync(font.outputFontPath));
}
function collectSiteCharacters(alwaysInclude) {
  const chars = new Set(alwaysInclude.split(''));

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
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
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

function createSubsetHash(chars, fontSourceVersion) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        chars,
        fontSourceVersion,
        options: SUBSET_OPTIONS,
      }),
    )
    .digest('hex');
}

function readSubsetMeta(metaPath) {
  if (!fs.existsSync(metaPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
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

async function downloadSourceFont(targetPath, url, label) {
  console.log(`font:subset downloading ${label} source font from ${url}`);

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





