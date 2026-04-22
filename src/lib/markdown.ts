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

const prettyCodeOptions = {
  theme: {
    dark: 'github-dark-dimmed',
    light: 'github-light',
  },
  keepBackground: false,
  defaultLang: 'plaintext',
} as const;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, {
    behavior: 'wrap',
    properties: { className: ['heading-anchor'] },
  })
  .use(rehypePrettyCode, prettyCodeOptions)
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function renderMarkdown(raw: string): Promise<string> {
  const file = await processor.process(raw);
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
    if (depth >= 2 && depth <= 4) {
      items.push({ depth, value, id: slugger.slug(value) });
    }
  }
  return items;
}
