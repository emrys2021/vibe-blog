import type { Metadata } from 'next';
import { getAllTags } from '@/lib/posts';
import { TaxonomyPill } from '@/components/TaxonomyPill';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

export const metadata: Metadata = {
  title: 'tags',
};

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <Container width="medium">
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>grep -roh &quot;tags:.*&quot; ./posts | sort | uniq -c</Prompt>
      </h1>

      {tags.length === 0 ? (
        <p className="text-sm text-fg-dim">no tags yet.</p>
      ) : (
        <div className="rounded-lg border border-rule bg-bg-elev/35 p-4">
          <ul className="flex flex-wrap gap-3 text-sm">
            {tags.map((bucket) => (
              <li key={bucket.tag}>
                <TaxonomyPill
                  href={`/tags/${encodeURIComponent(bucket.tag)}`}
                  label={bucket.tag}
                  count={bucket.count}
                  variant="tag"
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  );
}
