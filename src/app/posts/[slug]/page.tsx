import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAdjacentPosts, getAllSlugs, getPost } from '@/lib/posts';
import { formatDate } from '@/lib/format';
import { Prompt } from '@/components/Prompt';
import { Toc } from '@/components/Toc';
import { Container } from '@/components/Container';
import { siteConfig } from '../../../../blog.config';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description ?? siteConfig.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const { prev, next } = getAdjacentPosts(slug);

  return (
    <Container width="wide">
      <div className="md:grid md:grid-cols-[10rem_1fr] md:gap-6 lg:grid-cols-[12rem_1fr] lg:gap-10 xl:grid-cols-[14rem_1fr] xl:gap-12">
        {/* left sidebar TOC: sticky from md (≥768px) up */}
        <aside className="hidden md:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            <Toc items={post.toc} />
          </div>
        </aside>

        <article className="min-w-0">
          <div className="text-xs text-fg-dim mb-3">
            <Prompt>cat posts/{post.slug}.md</Prompt>
          </div>

          <header className="border-b border-rule pb-4 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-fg">
              # {post.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-dim">
              <time dateTime={post.date} className="tabular-nums">
                {formatDate(post.date)}
              </time>
              <span>·</span>
              <span>{post.readingTime}</span>
              <span>·</span>
              <span>{post.wordCount} words</span>
              {(post.tags ?? []).length > 0 ? (
                <>
                  <span>·</span>
                  <span className="flex flex-wrap gap-1.5">
                    {post.tags!.map((t) => (
                      <Link
                        key={t}
                        href={`/tags/${encodeURIComponent(t.toLowerCase())}`}
                        className="text-accent-2 hover:text-accent"
                      >
                        #{t}
                      </Link>
                    ))}
                  </span>
                </>
              ) : null}
            </div>
            {post.description ? (
              <p className="mt-3 text-sm text-fg-dim italic">
                {post.description}
              </p>
            ) : null}
          </header>

          {/* mobile-only inline TOC */}
          <div className="lg:hidden my-6 border border-rule rounded p-4 bg-bg-elev">
            <Toc items={post.toc} />
          </div>

          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

          <nav className="mt-12 pt-6 border-t border-rule grid sm:grid-cols-2 gap-4 text-sm">
            {prev ? (
              <Link
                href={`/posts/${prev.slug}`}
                className="group block border border-rule rounded p-3 hover:border-accent transition-colors"
              >
                <div className="text-xs text-fg-dim">← prev</div>
                <div className="mt-1 text-fg group-hover:text-accent">
                  {prev.title}
                </div>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/posts/${next.slug}`}
                className="group block border border-rule rounded p-3 text-right hover:border-accent transition-colors"
              >
                <div className="text-xs text-fg-dim">next →</div>
                <div className="mt-1 text-fg group-hover:text-accent">
                  {next.title}
                </div>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
      </div>
    </Container>
  );
}
