import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllTags, getPostsByTag } from '@/lib/posts';
import { PostCard } from '@/components/PostCard';
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
    <Container>
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>grep -lr &quot;tag:{decoded}&quot; ./posts</Prompt>
      </h1>
      <h2 className="text-xl font-semibold mb-4">
        <span className="text-accent-2">#</span>
        {decoded}
        <span className="ml-2 text-xs text-fg-dim font-normal">
          ({posts.length})
        </span>
      </h2>
      <div>
        {posts.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
    </Container>
  );
}
