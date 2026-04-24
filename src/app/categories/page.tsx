import type { Metadata } from 'next';
import { getCategoryHref } from '@/lib/categories';
import { getAllCategories } from '@/lib/posts';
import { TaxonomyPill } from '@/components/TaxonomyPill';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

export const metadata: Metadata = {
  title: 'categories',
};

export default function CategoriesPage() {
  const categories = getAllCategories();

  return (
    <Container width="medium">
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>ls -d ./posts/*/</Prompt>
      </h1>

      {categories.length === 0 ? (
        <p className="text-sm text-fg-dim">no categories yet.</p>
      ) : (
        <div className="rounded-lg border border-rule bg-bg-elev/35 p-4">
          <ul className="flex flex-wrap gap-3 text-sm">
            {categories.map((bucket) => (
              <li key={bucket.category}>
                <TaxonomyPill
                  href={getCategoryHref(bucket.segments)}
                  label={bucket.label}
                  count={bucket.count}
                  variant="category"
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  );
}
