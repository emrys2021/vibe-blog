import Link from 'next/link';
import type { PostMeta } from '@/lib/types';
import { formatDate } from '@/lib/format';

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <article className="group py-4 border-b border-rule last:border-b-0">
      <Link href={`/posts/${post.slug}`} className="block">
        <div className="flex items-baseline gap-3 flex-wrap">
          <time
            className="text-xs text-fg-dim tabular-nums"
            dateTime={post.date}
          >
            {formatDate(post.date)}
          </time>
          <h2 className="text-lg font-semibold text-fg group-hover:text-accent transition-colors">
            {post.title}
          </h2>
          {post.draft ? (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 border border-danger text-danger rounded">
              draft
            </span>
          ) : null}
        </div>
        {post.description ? (
          <p className="mt-1.5 text-sm text-fg-dim line-clamp-2">
            {post.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-dim">
          <span>{post.readingTime}</span>
          {post.category ? (
            <span
              className="text-accent"
              style={{ fontFamily: 'var(--font-prose)' }}
            >
              @{post.category}
            </span>
          ) : null}
          {(post.tags ?? []).length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {post.tags!.map((t) => (
                <span
                  key={t}
                  className="text-accent-2"
                  style={{ fontFamily: 'var(--font-prose)' }}
                >
                  #{t}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
