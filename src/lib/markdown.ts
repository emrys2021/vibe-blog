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

const prettyCodeOptions = {
  theme: {
    dark: 'github-dark-dimmed',
    light: 'github-light',
  },
  keepBackground: false,
  defaultLang: 'plaintext',
} as const;

const OBSIDIAN_EMBED_RE = /!\[\[([^\]]+)\]\]/g;
const IMAGE_EXT_RE = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
const ABSOLUTE_URL_RE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const MARKDOWN_SOURCE_RE = /\.(md|mdx|markdown)$/i;

interface RenderMarkdownOptions {
  slug?: string;
  postDir?: string;
}

interface SplitSpecifier {
  pathname: string;
  suffix: string;
}

function createProcessor(options: RenderMarkdownOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCallout)
    .use(remarkRewriteRelativeAssetUrls, options)
    .use(remarkRehype, { allowDangerousHtml: true })
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

interface MarkdownNode {
  type?: string;
  url?: string;
  children?: MarkdownNode[];
}

function visitMarkdownTree(node: MarkdownNode, visitor: (node: MarkdownNode) => void) {
  visitor(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) {
    visitMarkdownTree(child, visitor);
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

function isImagePath(specifier: string): boolean {
  const { pathname } = splitSpecifier(specifier);
  return IMAGE_EXT_RE.test(pathname);
}

function toPublicAssetUrl(slug: string, assetPath: string): string {
  const { pathname, suffix } = splitSpecifier(assetPath);
  return `/post-assets/${encodePathSegment(slug)}/${encodePath(pathname)}${suffix}`;
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
