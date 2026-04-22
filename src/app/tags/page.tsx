import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllTags } from '@/lib/posts';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

export const metadata: Metadata = {
  title: 'tags',
};

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <Container>
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>grep -roh &quot;tags:.*&quot; ./posts | sort | uniq -c</Prompt>
      </h1>

      {tags.length === 0 ? (
        <p className="text-sm text-fg-dim">no tags yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2 text-sm">
          {tags.map((bucket) => (
            <li key={bucket.tag}>
              <Link
                href={`/tags/${encodeURIComponent(bucket.tag)}`}
                className="inline-flex items-baseline gap-1.5 px-2 py-1 border border-rule rounded hover:border-accent hover:text-accent transition-colors"
              >
                <span className="text-accent-2">#{bucket.tag}</span>
                <span className="text-xs text-fg-dim">
                  {bucket.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
