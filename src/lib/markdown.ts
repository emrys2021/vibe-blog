import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeStringify from 'rehype-stringify';
import GithubSlugger from 'github-slugger';
import type { TocItem } from './types';
import { remarkCallout } from './remark-callout';
import { siteConfig } from '../../blog.config';

const prettyCodeOptions = {
  theme: {
    dark: 'github-dark-dimmed',
    light: 'github-light',
  },
  keepBackground: false,
  defaultLang: 'plaintext',
} as const;

const OBSIDIAN_EMBED_RE = /!\[\[([^\]]+)\]\]/g;
const OBSIDIAN_LINK_RE = /(^|[^!])\[\[([^\]]+)\]\]/g;
const IMAGE_EXT_RE = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
const ABSOLUTE_URL_RE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const MARKDOWN_SOURCE_RE = /\.(md|mdx|markdown)$/i;
const SITE_ORIGIN = new URL(siteConfig.url).origin;
const imageDimensionsCache = new Map<string, ImageDimensions | null>();

interface RenderMarkdownOptions {
  slug?: string;
  postDir?: string;
  resolveObsidianLink?: (target: string) => string | null;
}

interface SplitSpecifier {
  pathname: string;
  suffix: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function createProcessor(options: RenderMarkdownOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCallout)
    .use(remarkRewriteRelativeAssetUrls, options)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeExternalArticleLinks)
    .use(rehypeOptimizeArticleImages, options)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: { className: ['heading-anchor'] },
    })
    .use(rehypePrettyCode, prettyCodeOptions)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

export async function renderMarkdown(
  raw: string,
  options: RenderMarkdownOptions = {},
): Promise<string> {
  const file = await createProcessor(options).process(
    preprocessObsidianEmbeds(raw, options),
  );
  return String(file);
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/gm;

export function extractToc(raw: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let match: RegExpExecArray | null;
  // strip fenced code blocks so we don't catch hashes inside them
  const stripped = raw.replace(/```[\s\S]*?```/g, '');
  while ((match = HEADING_RE.exec(stripped)) !== null) {
    const depth = match[1].length;
    const value = match[2].replace(/[*_`]/g, '').trim();
    if (depth >= 1 && depth <= 6) {
      items.push({ depth, value, id: slugger.slug(value) });
    }
  }
  return items;
}

function remarkRewriteRelativeAssetUrls(options: RenderMarkdownOptions = {}) {
  return (tree: MarkdownNode) => {
    visitMarkdownTree(tree, (node) => {
      if (
        (node.type === 'image' || node.type === 'link' || node.type === 'definition') &&
        typeof node.url === 'string'
      ) {
        const rewritten = rewriteRelativeAssetUrl(node.url, node.type, options);
        if (rewritten) {
          node.url = rewritten;
        }
      }
    });
  };
}

function rehypeExternalArticleLinks() {
  return (tree: HastNode) => {
    visitHastTree(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'a') return;

      const href = typeof node.properties?.href === 'string'
        ? node.properties.href
        : null;
      if (!href || !shouldOpenInNewTab(href)) return;

      node.properties = {
        ...node.properties,
        target: '_blank',
        rel: 'noopener noreferrer',
      };
    });
  };
}

function rehypeOptimizeArticleImages(options: RenderMarkdownOptions = {}) {
  return (tree: HastNode) => {
    visitHastTree(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'img') return;

      const src = typeof node.properties?.src === 'string'
        ? node.properties.src
        : null;

      node.properties = {
        ...node.properties,
        loading: node.properties?.loading ?? 'lazy',
        decoding: node.properties?.decoding ?? 'async',
      };

      if (!src || node.properties.width || node.properties.height) return;

      const imagePath = resolvePublicImageFilePath(src, options);
      if (!imagePath) return;

      const dimensions = getImageDimensions(imagePath);
      if (!dimensions) return;

      node.properties.width = dimensions.width;
      node.properties.height = dimensions.height;
    });
  };
}

interface MarkdownNode {
  type?: string;
  url?: string;
  children?: MarkdownNode[];
}

interface HastNode {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function visitMarkdownTree(node: MarkdownNode, visitor: (node: MarkdownNode) => void) {
  visitor(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) {
    visitMarkdownTree(child, visitor);
  }
}

function visitHastTree(node: HastNode, visitor: (node: HastNode) => void) {
  visitor(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) {
    visitHastTree(child, visitor);
  }
}

function preprocessObsidianEmbeds(raw: string, options: RenderMarkdownOptions): string {
  if (!options.slug || !options.postDir) return raw;

  return raw.replace(OBSIDIAN_EMBED_RE, (fullMatch, specifier: string) => {
    const [target, alias] = splitObsidianSpecifier(specifier);
    const assetPath = resolveBundledAssetPath(target, options.postDir);
    if (!assetPath) return fullMatch;

    const publicUrl = toPublicAssetUrl(options.slug!, assetPath);
    const label = getObsidianLabel(target, alias);

    if (isImagePath(target)) {
      return `![${escapeMarkdownText(label)}](${publicUrl})`;
    }

    return `[${escapeMarkdownText(label)}](${publicUrl})`;
  });
}

function splitObsidianSpecifier(specifier: string): [string, string | null] {
  const separatorIndex = specifier.indexOf('|');
  if (separatorIndex === -1) {
    return [specifier.trim(), null];
  }

  const target = specifier.slice(0, separatorIndex).trim();
  const alias = specifier.slice(separatorIndex + 1).trim();
  return [target, alias || null];
}

function getObsidianLabel(target: string, alias: string | null): string {
  if (alias && !/^\d+(?:x\d+)?$/.test(alias)) {
    return alias;
  }

  const basename = target.split('/').pop() ?? target;
  return basename.replace(/\.[^.]+$/, '');
}

function rewriteRelativeAssetUrl(
  url: string,
  nodeType: string | undefined,
  options: RenderMarkdownOptions,
): string | null {
  if (!options.slug || !options.postDir) return null;
  if (isAbsoluteOrDocumentUrl(url)) return null;
  if (nodeType !== 'image' && !shouldRewriteAssetLikeLink(url, options.postDir)) {
    return null;
  }

  const assetPath = resolveBundledAssetPath(url, options.postDir);
  if (!assetPath) return null;

  return toPublicAssetUrl(options.slug, assetPath);
}

function resolveBundledAssetPath(
  rawSpecifier: string,
  postDir?: string,
): string | null {
  if (!postDir) return null;

  const normalized = normalizeRelativeSpecifier(rawSpecifier);
  if (!normalized) return null;

  const { pathname, suffix } = splitSpecifier(normalized);
  const directPath = toFileSystemPath(postDir, pathname);
  if (fs.existsSync(directPath)) {
    return `${pathname}${suffix}`;
  }

  if (!pathname.includes('/')) {
    const attachmentsPath = toFileSystemPath(
      postDir,
      path.posix.join('attachments', pathname),
    );
    if (fs.existsSync(attachmentsPath)) {
      return `${path.posix.join('attachments', pathname)}${suffix}`;
    }
  }

  return `${pathname}${suffix}`;
}

function shouldRewriteAssetLikeLink(url: string, postDir: string): boolean {
  const normalized = normalizeRelativeSpecifier(url);
  if (!normalized) return false;

  const { pathname } = splitSpecifier(normalized);
  if (MARKDOWN_SOURCE_RE.test(pathname)) return false;
  if (path.posix.extname(pathname)) return true;

  const assetPath = resolveBundledAssetPath(url, postDir);
  if (!assetPath) return false;

  const filePath = toFileSystemPath(postDir, splitSpecifier(assetPath).pathname);
  return fs.existsSync(filePath) && !MARKDOWN_SOURCE_RE.test(filePath);
}

function normalizeRelativeSpecifier(rawSpecifier: string): string | null {
  const trimmed = rawSpecifier.trim().replace(/^<|>$/g, '');
  if (!trimmed || isAbsoluteOrDocumentUrl(trimmed)) return null;

  const { pathname, suffix } = splitSpecifier(trimmed.replace(/\\/g, '/'));
  const normalized = path.posix
    .normalize(pathname)
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');

  if (!normalized || normalized === '.' || normalized.startsWith('../')) {
    return null;
  }

  return `${normalized}${suffix}`;
}

function splitSpecifier(specifier: string): SplitSpecifier {
  const match = /^(.*?)([?#].*)?$/.exec(specifier);
  return {
    pathname: match?.[1] ?? specifier,
    suffix: match?.[2] ?? '',
  };
}

function isAbsoluteOrDocumentUrl(url: string): boolean {
  return (
    ABSOLUTE_URL_RE.test(url) ||
    url.startsWith('/') ||
    url.startsWith('#') ||
    url.startsWith('?')
  );
}

function shouldOpenInNewTab(url: string): boolean {
  if (!ABSOLUTE_URL_RE.test(url)) return false;

  try {
    const resolved = new URL(url, siteConfig.url);
    if (!/^https?:$/.test(resolved.protocol)) {
      return false;
    }

    return resolved.origin !== SITE_ORIGIN;
  } catch {
    return false;
  }
}

function resolvePublicImageFilePath(
  src: string,
  options: RenderMarkdownOptions,
): string | null {
  if (!options.slug || !options.postDir) return null;
  if (!src.startsWith('/post-assets/')) return null;

  const { pathname } = splitSpecifier(src);
  const slugPrefix = `/post-assets/${encodePath(options.slug)}/`;
  if (!pathname.startsWith(slugPrefix)) return null;

  const relativePath = pathname.slice(slugPrefix.length);
  if (!relativePath) return null;

  return toFileSystemPath(options.postDir, relativePath);
}

function getImageDimensions(filePath: string): ImageDimensions | null {
  if (imageDimensionsCache.has(filePath)) {
    return imageDimensionsCache.get(filePath) ?? null;
  }

  let dimensions: ImageDimensions | null = null;

  try {
    const buffer = fs.readFileSync(filePath);
    dimensions =
      getPngDimensions(buffer) ??
      getGifDimensions(buffer) ??
      getJpegDimensions(buffer) ??
      getWebpDimensions(buffer) ??
      getSvgDimensions(buffer);
  } catch {
    dimensions = null;
  }

  imageDimensionsCache.set(filePath, dimensions);
  return dimensions;
}

function getPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (
    buffer.length < 24 ||
    buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function getGifDimensions(buffer: Buffer): ImageDimensions | null {
  const header = buffer.toString('ascii', 0, 6);
  if (buffer.length < 10 || (header !== 'GIF87a' && header !== 'GIF89a')) {
    return null;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function getJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }

    if (isJpegStartOfFrame(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function getWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
    };
  }

  if (chunk === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === 'VP8L' && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

function getSvgDimensions(buffer: Buffer): ImageDimensions | null {
  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));
  if (!text.includes('<svg')) return null;

  const width = getSvgNumericAttribute(text, 'width');
  const height = getSvgNumericAttribute(text, 'height');
  if (width && height) {
    return { width, height };
  }

  const viewBox = /\bviewBox=["']\s*[-.\d]+\s+[-.\d]+\s+([.\d]+)\s+([.\d]+)/i.exec(text);
  if (!viewBox) return null;

  return {
    width: Math.round(Number(viewBox[1])),
    height: Math.round(Number(viewBox[2])),
  };
}

function getSvgNumericAttribute(text: string, name: string): number | null {
  const match = new RegExp(`\\b${name}=["']([\\d.]+)(?:px)?["']`, 'i').exec(text);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function isImagePath(specifier: string): boolean {
  const { pathname } = splitSpecifier(specifier);
  return IMAGE_EXT_RE.test(pathname);
}

function toPublicAssetUrl(slug: string, assetPath: string): string {
  const { pathname, suffix } = splitSpecifier(assetPath);
  return `/post-assets/${encodePath(slug)}/${encodePath(pathname)}${suffix}`;
}

function encodePath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => encodePathSegment(segment))
    .join('/');
}

function encodePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function toFileSystemPath(baseDir: string, relativePath: string): string {
  return path.join(
    baseDir,
    ...relativePath.split('/').map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    }),
  );
}

function escapeMarkdownText(value: string): string {
  return value.replace(/[[\]\\]/g, '\\$&');
}


