import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategoryHref } from '@/lib/categories';
import { getAllCategories } from '@/lib/posts';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

export const metadata: Metadata = {
  title: 'categories',
};

export default function CategoriesPage() {
  const categories = getAllCategories();

  return (
    <Container>
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>ls -d ./posts/*/</Prompt>
      </h1>

      {categories.length === 0 ? (
        <p className="text-sm text-fg-dim">no categories yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2 text-sm">
          {categories.map((bucket) => (
            <li key={bucket.category}>
              <Link
                href={getCategoryHref(bucket.segments)}
                className="inline-flex items-baseline gap-1.5 px-2 py-1 border border-rule rounded hover:border-accent hover:text-accent transition-colors"
              >
                <span className="text-accent">@{bucket.label}</span>
                <span className="text-xs text-fg-dim">{bucket.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
