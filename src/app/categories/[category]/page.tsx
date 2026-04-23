import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllCategories, getPostsByCategory } from '@/lib/posts';
import { PostCard } from '@/components/PostCard';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return getAllCategories().map((b) => ({ category: b.category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  return { title: `@${decodeURIComponent(category)}` };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const decoded = decodeURIComponent(category);
  const posts = getPostsByCategory(decoded);
  if (posts.length === 0) notFound();

  return (
    <Container>
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>ls ./posts/{decoded}/</Prompt>
      </h1>
      <h2 className="text-xl font-semibold mb-4">
        <span className="text-accent">@</span>
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
