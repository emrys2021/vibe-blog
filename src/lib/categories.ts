function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function splitCategoryPath(value?: string | string[]): string[] {
  const rawSegments = Array.isArray(value) ? value : (value?.split('/') ?? []);
  return rawSegments
    .map((segment) => safeDecode(segment).trim())
    .filter(Boolean);
}

export function normalizeCategoryPath(value?: string | string[]): string | undefined {
  const segments = splitCategoryPath(value);
  return segments.length > 0 ? segments.join('/') : undefined;
}

export function canonicalizeCategoryPath(value?: string | string[]): string | undefined {
  const normalized = normalizeCategoryPath(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

export function getCanonicalCategorySegments(value?: string | string[]): string[] {
  return splitCategoryPath(value).map((segment) => segment.toLowerCase());
}

export function getCanonicalCategoryPrefixes(value?: string | string[]): string[] {
  const segments = getCanonicalCategorySegments(value);
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

export function getDisplayCategoryPrefixes(value?: string | string[]): string[] {
  const segments = splitCategoryPath(value);
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

export function getCategoryHref(value?: string | string[]): string {
  const segments = getCanonicalCategorySegments(value);
  return segments.length > 0
    ? `/categories/${segments.map(encodeURIComponent).join('/')}`
    : '/categories';
}
