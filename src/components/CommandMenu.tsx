'use client';

import { forwardRef, type ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Action, ActionImpl } from 'kbar';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarProvider,
  KBarResults,
  KBarSearch,
  useKBar,
  useMatches,
  useRegisterActions,
} from 'kbar';
import { getCategoryHref } from '@/lib/categories';
import { applyTheme, getTheme, type Theme } from '@/lib/theme';
import type { CommandMenuData } from '@/lib/types';
import { siteConfig } from '../../blog.config';

const SECTIONS = {
  pages: { name: 'Pages', priority: 600 },
  page: { name: 'Page', priority: 500 },
  posts: { name: 'Posts', priority: 400 },
  tags: { name: 'Tags', priority: 300 },
  categories: { name: 'Categories', priority: 200 },
  preferences: { name: 'Preferences', priority: 100 },
} as const;

interface CommandMenuProviderProps {
  children: ReactNode;
  data: CommandMenuData;
}

interface PageHeading {
  id: string;
  depth: number;
  text: string;
}

export function CommandMenuProvider({ children, data }: CommandMenuProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pageHeadings, setPageHeadings] = useState<PageHeading[]>([]);

  const globalActions = useMemo<Action[]>(() => {
    const pageActions = siteConfig.nav.map((item) => ({
      id: `goto-${item.href === '/' ? 'home' : item.href.slice(1).replaceAll('/', '-')}`,
      name: item.href === '/' ? 'Go to home' : `Go to ${item.label}`,
      subtitle: item.href,
      section: SECTIONS.pages,
      icon: '~/',
      keywords: `${item.label} page route navigation`,
      perform: () => router.push(item.href),
    }));

    const themeActions: Action[] = [
      {
        id: 'change-theme',
        name: 'Change theme',
        subtitle: 'Light or dark',
        section: SECTIONS.preferences,
        icon: 'cfg',
        keywords: 'theme appearance color mode dark light',
      },
      {
        id: 'theme-dark',
        name: 'Switch to dark theme',
        parent: 'change-theme',
        icon: '☾',
        keywords: 'dark night theme',
        perform: () => applyTheme('dark'),
      },
      {
        id: 'theme-light',
        name: 'Switch to light theme',
        parent: 'change-theme',
        icon: '☀',
        keywords: 'light day theme',
        perform: () => applyTheme('light'),
      },
      {
        id: 'toggle-theme',
        name: 'Toggle theme',
        section: SECTIONS.preferences,
        icon: 'cfg',
        keywords: 'theme switch toggle dark light',
        perform: () => {
          const nextTheme: Theme = getTheme() === 'dark' ? 'light' : 'dark';
          applyTheme(nextTheme);
        },
      },
    ];

    const postActions = data.posts.map((post) => ({
      id: `post-${post.slug}`,
      name: post.title,
      subtitle: post.description ?? `/posts/${post.slug}`,
      section: SECTIONS.posts,
      icon: 'md',
      keywords: post.searchText,
      perform: () => router.push(`/posts/${encodeURIComponent(post.slug)}`),
    }));

    const tagActions = data.tags.map((tag) => ({
      id: `tag-${tag.tag}`,
      name: `#${tag.tag}`,
      subtitle: `${tag.count} ${tag.count === 1 ? 'post' : 'posts'}`,
      section: SECTIONS.tags,
      icon: '#',
      keywords: `${tag.tag} tag taxonomy`,
      perform: () => router.push(`/tags/${encodeURIComponent(tag.tag)}`),
    }));

    const categoryActions = data.categories.map((category) => ({
      id: `category-${category.category}`,
      name: `@${category.label}`,
      subtitle: `${category.count} ${category.count === 1 ? 'post' : 'posts'}`,
      section: SECTIONS.categories,
      icon: '@',
      keywords: `${category.label} category taxonomy ${category.category}`,
      perform: () => router.push(getCategoryHref(category.category)),
    }));

    const utilityActions: Action[] = [];
    if (data.posts.length > 0) {
      utilityActions.push({
        id: 'open-random-post',
        name: 'Open random post',
        subtitle: 'Jump somewhere unexpected',
        section: SECTIONS.posts,
        icon: 'rnd',
        keywords: 'random surprise article post explore',
        perform: () => {
          const currentSlug = pathname?.startsWith('/posts/')
            ? decodeURIComponent(pathname.split('/').pop() ?? '')
            : null;
          const pool = data.posts.filter((post) => post.slug !== currentSlug);
          const source = pool.length > 0 ? pool : data.posts;
          const randomPost = source[Math.floor(Math.random() * source.length)];
          router.push(`/posts/${encodeURIComponent(randomPost.slug)}`);
        },
      });
    }

    return [
      ...pageActions,
      ...utilityActions,
      ...themeActions,
      ...postActions,
      ...tagActions,
      ...categoryActions,
    ];
  }, [data.categories, data.posts, data.tags, pathname, router]);

  useEffect(() => {
    const collectHeadings = () => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          'article h1[id], article h2[id], article h3[id], article h4[id], article h5[id], article h6[id]',
        ),
      );
      setPageHeadings(
        nodes.map((node) => ({
          id: node.id,
          depth: Number(node.tagName.slice(1)) || 2,
          text: node.textContent?.trim() || node.id,
        })),
      );
    };

    collectHeadings();
    const frame = window.requestAnimationFrame(collectHeadings);
    const timer = window.setTimeout(collectHeadings, 160);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <KBarProvider
      actions={globalActions}
      options={{
        enableHistory: true,
        disableScrollbarManagement: true,
        animations: { enterMs: 120, exitMs: 100 },
      }}
    >
      <PageScopedActions pathname={pathname} headings={pageHeadings} />
      {children}
      <CommandMenuPalette />
    </KBarProvider>
  );
}

function PageScopedActions({
  pathname,
  headings,
}: {
  pathname: string;
  headings: PageHeading[];
}) {
  const pageKey = pathname === '/' ? 'home' : pathname.replace(/[^\w-]+/g, '-');

  const actions = useMemo<Action[]>(() => {
    const rootId = `jump-to-section-${pageKey}`;
    const pageActions: Action[] = [
      {
        id: `scroll-to-top-${pageKey}`,
        name: 'Scroll to top',
        subtitle: 'Jump back to the start of this page',
        section: SECTIONS.page,
        icon: 'top',
        keywords: 'scroll top start beginning home',
        perform: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      },
      {
        id: `scroll-to-bottom-${pageKey}`,
        name: 'Scroll to bottom',
        subtitle: 'Skip to the end of this page',
        section: SECTIONS.page,
        icon: 'end',
        keywords: 'scroll bottom end footer last',
        perform: () => {
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth',
          });
        },
      },
      {
        id: `copy-link-${pageKey}`,
        name: 'Copy current page link',
        subtitle: pathname,
        section: SECTIONS.page,
        icon: 'url',
        keywords: 'copy share link url address permalink',
        perform: async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
          } catch {
            /* clipboard may be unavailable */
          }
        },
      },
    ];

    if (headings.length === 0) return pageActions;

    return [
      ...pageActions,
      {
        id: rootId,
        name: 'Jump to section',
        subtitle: `${headings.length} headings on this page`,
        section: SECTIONS.page,
        icon: 'toc',
        keywords: 'heading section outline toc anchor jump',
      },
      ...headings.map((heading) => ({
        id: `${rootId}-${heading.id}`,
        name: heading.text,
        subtitle: `H${heading.depth}`,
        parent: rootId,
        icon: `H${heading.depth}`,
        keywords: `${heading.text} heading section h${heading.depth}`,
        perform: () => scrollToHeading(heading.id),
      })),
    ];
  }, [headings, pageKey, pathname]);

  useRegisterActions(actions, [actions]);
  return null;
}

function CommandMenuPalette() {
  const { results } = useMatches();
  const { searchQuery } = useKBar((state) => ({ searchQuery: state.searchQuery }));
  const searchStyle = containsCjk(searchQuery)
    ? { fontFamily: 'var(--font-prose)' as const }
    : undefined;

  return (
    <KBarPortal>
      <KBarPositioner className="fixed inset-0 z-[90] bg-black/55 px-4 backdrop-blur-sm">
        <KBarAnimator className="w-full max-w-3xl overflow-hidden rounded-2xl border border-rule bg-bg-elev/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-rule px-4 pb-3 pt-4">
            <div className="text-[10px] uppercase tracking-[0.28em] text-fg-dim">
              command palette
            </div>
            <KBarSearch
              className="mt-3 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-dim"
              defaultPlaceholder="Search posts, pages, tags, categories, or actions..."
              style={searchStyle}
            />
          </div>

          {results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-fg-dim">
              no matches. try a post title, tag, page, or action keyword.
            </div>
          ) : (
            <KBarResults
              items={results}
              maxHeight={560}
              onRender={({ item, active }) =>
                typeof item === 'string' ? (
                  <div className="px-4 pb-2 pt-4 text-[10px] uppercase tracking-[0.24em] text-fg-dim first:pt-3">
                    {item}
                  </div>
                ) : (
                <ResultItem action={item} active={active} />
              )
            }
          />
        )}
      </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}

const ResultItem = forwardRef<HTMLDivElement, { action: ActionImpl; active: boolean }>(
  function ResultItem({ action, active }, ref) {
  const isSectionJumpChild =
    action.ancestors.length > 0 && action.ancestors[action.ancestors.length - 1]?.name === 'Jump to section';
  const breadcrumb = isSectionJumpChild
    ? ''
    : action.ancestors.map((ancestor) => ancestor.name).join(' / ');
  const shortcut = action.shortcut?.join(' ');
  const headingLevel = isSectionJumpChild ? Number(action.subtitle?.replace(/\D/g, '') || '2') : null;
  const indentStyle = isSectionJumpChild
    ? { paddingLeft: `${Math.max(0, (headingLevel ?? 2) - 2) * 0.7}rem` }
    : undefined;
  const nameStyle = isSectionJumpChild || containsCjk(action.name)
    ? { fontFamily: 'var(--font-prose)' as const }
    : undefined;
  const subtitleStyle = action.subtitle && containsCjk(action.subtitle)
    ? { fontFamily: 'var(--font-prose)' as const }
    : undefined;
  const breadcrumbStyle = breadcrumb && containsCjk(breadcrumb)
    ? { fontFamily: 'var(--font-prose)' as const }
    : undefined;

  return (
    <div
      ref={ref}
      className={`mx-2 mb-1 flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        active ? 'border-accent bg-bg' : 'border-transparent'
      }`}
      style={indentStyle}
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rule bg-bg text-[11px] text-accent">
        {action.icon ?? '>'}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-fg" style={nameStyle}>
          {action.name}
        </div>
        {action.subtitle && !isSectionJumpChild ? (
          <div className="mt-1 truncate text-xs text-fg-dim" style={subtitleStyle}>
            {action.subtitle}
          </div>
        ) : null}
        {breadcrumb ? (
          <div className="mt-1 truncate text-[11px] text-fg-dim/90" style={breadcrumbStyle}>
            {breadcrumb}
          </div>
        ) : null}
      </div>

      {isSectionJumpChild ? (
        <div className="rounded border border-rule px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-dim">
          {action.subtitle}
        </div>
      ) : shortcut ? (
        <div className="hidden rounded border border-rule px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-dim sm:block">
          {shortcut}
        </div>
      ) : action.children.length > 0 ? (
        <div className="hidden text-xs text-fg-dim sm:block">enter</div>
      ) : null}
    </div>
  );
});

function containsCjk(value?: string | null): boolean {
  return Boolean(value && /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(value));
}

function scrollToHeading(id: string) {
  const heading = document.getElementById(id);
  if (!heading) return;

  const offset = 104;
  const top = heading.getBoundingClientRect().top + window.scrollY - offset;
  window.history.replaceState(null, '', `#${id}`);
  window.scrollTo({ top, behavior: 'smooth' });
}
