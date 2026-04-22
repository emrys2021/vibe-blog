import Link from 'next/link';
import { getAllPosts } from '@/lib/posts';
import { PostCard } from '@/components/PostCard';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';
import { siteConfig } from '../../blog.config';

export default function HomePage() {
  const posts = getAllPosts();
  const recent = posts.slice(0, siteConfig.postsPerPage);

  return (
    <Container>
      <section className="mb-10">
        <h1 className="text-base text-fg-dim">
          <Prompt cursor>
            whoami && cat about.txt
          </Prompt>
        </h1>
        <div className="mt-4 pl-4 border-l-2 border-rule text-sm leading-relaxed">
          <p className="text-fg">
            <span className="text-accent">{siteConfig.author.name}</span>{' '}
            <span className="text-fg-dim">— {siteConfig.author.bio}</span>
          </p>
          <p className="text-fg-dim mt-1">{siteConfig.description}</p>
        </div>
      </section>

      <section>
        <h2 className="text-sm text-fg-dim mb-2">
          <Prompt>ls -lah ./posts</Prompt>
        </h2>
        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <div>
            {recent.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}

        {posts.length > recent.length ? (
          <div className="mt-6 text-sm">
            <Link
              href="/archive"
              className="text-accent-2 hover:text-accent"
            >
              → see all {posts.length} posts in archive
            </Link>
          </div>
        ) : null}
      </section>
    </Container>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-rule rounded p-6 text-sm text-fg-dim">
      <p>
        <span className="text-danger">!</span> no posts found.
      </p>
      <p className="mt-2">
        drop a markdown file into <code>content/posts/</code> to get started:
      </p>
      <pre className="mt-3 p-3 bg-bg-elev rounded border border-rule overflow-x-auto">
        <code>{`content/posts/
  hello-world/
    index.md
  another-post.md`}</code>
      </pre>
    </div>
  );
}
