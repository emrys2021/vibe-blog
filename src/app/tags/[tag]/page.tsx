import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllTags, getPostsByTag } from '@/lib/posts';
import { PostCard } from '@/components/PostCard';
import { TaxonomyPill } from '@/components/TaxonomyPill';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

interface Props {
  params: Promise<{ tag: string }>;
}

export async function generateStaticParams() {
  return getAllTags().map((b) => ({ tag: b.tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)}` };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);
  if (posts.length === 0) notFound();

  return (
    <Container width="medium">
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>grep -lr &quot;tag:{decoded}&quot; ./posts</Prompt>
      </h1>
      <div className="mb-5">
        <TaxonomyPill
          href={`/tags/${encodeURIComponent(decoded)}`}
          label={decoded}
          count={posts.length}
          variant="tag"
          active
        />
      </div>
      <div>
        {posts.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
    </Container>
  );
}
