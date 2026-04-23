import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategoryHref } from '@/lib/categories';
import { getCategoryBucket, getAllCategories, getPostsByCategory } from '@/lib/posts';
import { PostCard } from '@/components/PostCard';
import { TaxonomyPill } from '@/components/TaxonomyPill';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

interface Props {
  params: Promise<{ category: string[] }>;
}

export async function generateStaticParams() {
  return getAllCategories().map((bucket) => ({ category: bucket.segments }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const bucket = getCategoryBucket(category);
  return { title: `@${bucket?.label ?? category.join('/')}` };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const bucket = getCategoryBucket(category);
  if (!bucket) notFound();

  const posts = getPostsByCategory(category);
  const label = bucket.label;

  return (
    <Container>
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>ls ./posts/{label}/</Prompt>
      </h1>
      <div className="mb-5">
        <TaxonomyPill
          href={getCategoryHref(bucket.segments)}
          label={label}
          count={posts.length}
          variant="category"
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
