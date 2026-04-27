import type { MetadataRoute } from 'next';
import { getCategoryHref } from '@/lib/categories';
import { getAllCategories, getAllPosts, getAllTags } from '@/lib/posts';
import { encodeSlugPath } from '@/lib/post-urls';
import { siteConfig } from '../../blog.config';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, '');
  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/archive`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/categories`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${base}/tags`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${base}/about`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const posts = getAllPosts().map((p) => ({
    url: `${base}/posts/${encodeSlugPath(p.slug)}`,
    lastModified: new Date(p.date),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const tags = getAllTags().map((t) => ({
    url: `${base}/tags/${encodeURIComponent(t.tag)}`,
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }));

  const categories = getAllCategories().map((c) => ({
    url: `${base}${getCategoryHref(c.segments)}`,
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }));

  return [...staticUrls, ...posts, ...tags, ...categories];
}

