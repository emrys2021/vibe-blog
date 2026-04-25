import { getAllPosts } from '@/lib/posts';
import { siteConfig } from '../../../blog.config';

export const dynamic = 'force-static';
const FEED_PATH = '/rss.xml';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET() {
  const posts = getAllPosts();
  const feedUrl = `${siteConfig.url}${FEED_PATH}`;
  const items = posts
    .map((post) => {
      const link = `${siteConfig.url}/posts/${encodeURIComponent(post.slug)}`;
      const categories = [
        post.category ? `<category>${escapeXml(post.category)}</category>` : '',
        ...(post.tags ?? []).map((tag) => `<category>${escapeXml(tag)}</category>`),
      ]
        .filter(Boolean)
        .join('\n      ');

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      ${categories}
      <author>${escapeXml(`${siteConfig.author.email} (${siteConfig.author.name})`)}</author>
      ${post.description ? `<description>${escapeXml(post.description)}</description>` : ''}
    </item>`;
    })
    .join('\n');

  const lastBuildDate =
    posts.length > 0
      ? new Date(posts[0].date).toUTCString()
      : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.title)}</title>
    <link>${siteConfig.url}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>${escapeXml(siteConfig.language)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
