import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllPosts, groupByYear } from '@/lib/posts';
import { formatDate } from '@/lib/format';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

export const metadata: Metadata = {
  title: 'archive',
};

export default function ArchivePage() {
  const grouped = groupByYear(getAllPosts());

  return (
    <Container width="medium">
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>find ./posts -type f -name &quot;*.md&quot; | sort -r</Prompt>
      </h1>

      {grouped.length === 0 ? (
        <p className="text-sm text-fg-dim">no posts.</p>
      ) : (
        grouped.map(({ year, posts }) => (
          <section key={year} className="mb-8">
            <h2 className="text-lg font-semibold text-accent mb-2">
              {year}
              <span className="ml-2 text-xs text-fg-dim font-normal">
                ({posts.length})
              </span>
            </h2>
            <ul className="space-y-1.5">
              {posts.map((post) => (
                <li
                  key={post.slug}
                  className="flex items-baseline gap-3 text-sm"
                >
                  <time
                    className="text-fg-dim tabular-nums shrink-0"
                    dateTime={post.date}
                  >
                    {formatDate(post.date).slice(5)}
                  </time>
                  <Link
                    href={`/posts/${post.slug}`}
                    style={{ fontFamily: 'var(--font-prose)' }}
                    className="text-fg hover:text-accent transition-colors truncate"
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Container>
  );
}
