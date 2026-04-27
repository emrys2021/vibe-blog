export function getPostHref(slug: string): string {
  return `/posts/${encodeSlugPath(slug)}`;
}

export function encodeSlugPath(slug: string): string {
  return slug
    .split('/')
    .filter(Boolean)
    .map(encodePathSegment)
    .join('/');
}

export function decodeSlugParam(slug: string | string[]): string {
  const parts = Array.isArray(slug) ? slug : [slug];
  return parts.map(safeDecode).join('/');
}

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment);
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
