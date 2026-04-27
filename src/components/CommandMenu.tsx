'use client';

import { forwardRef } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Action, ActionImpl } from 'kbar';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarProvider,
  KBarResults,
  KBarSearch,
  VisualState,
  useKBar,
  useMatches,
  useRegisterActions,
} from 'kbar';
import { getCategoryHref } from '@/lib/categories';
import { applyTheme, getTheme, type Theme } from '@/lib/theme';
import type { CommandMenuData, CommandMenuFullTextData } from '@/lib/types';
import { siteConfig } from '../../blog.config';
import {
  COMMAND_MENU_FULLTEXT_INDEX_PATH,
  COMMAND_MENU_TOGGLE_EVENT,
} from './command-menu-events';

const SECTIONS = {
  pages: { name: 'Pages', priority: 600 },
  page: { name: 'Page', priority: 500 },
  posts: { name: 'Posts', priority: 400 },
  tags: { name: 'Tags', priority: 300 },
  categories: { name: 'Categories', priority: 200 },
  preferences: { name: 'Preferences', priority: 100 },
} as const;

interface CommandMenuOverlayProps {
  data: CommandMenuData;
  initialToggleToken?: number;
}

interface PageHeading {
  id: string;
  depth: number;
  text: string;
}

type FullTextLoadState = 'idle' | 'loading' | 'ready' | 'error';

let commandMenuFullTextPromise: Promise<CommandMenuFullTextData> | null = null;

function loadCommandMenuFullText() {
  if (!commandMenuFullTextPromise) {
    commandMenuFullTextPromise = fetch(COMMAND_MENU_FULLTEXT_INDEX_PATH, {
      cache: 'force-cache',
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `command menu full-text index request failed (${response.status})`,
        );
      }

      return (await response.json()) as CommandMenuFullTextData;
    });
  }

  return commandMenuFullTextPromise;
}

export function CommandMenuOverlay({
  data,
  initialToggleToken = 0,
}: CommandMenuOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pageHeadings, setPageHeadings] = useState<PageHeading[]>([]);
  const [fullTextData, setFullTextData] =
    useState<CommandMenuFullTextData | null>(null);
  const [fullTextLoadState, setFullTextLoadState] =
    useState<FullTextLoadState>('idle');
  const loadingFullTextRef = useRef(false);

  const fullTextBySlug = useMemo(
    () =>
      new Map(
        fullTextData?.posts.map((post) => [post.slug, post.searchText]) ?? [],
      ),
    [fullTextData],
  );

  const warmFullTextIndex = useCallback(async () => {
    if (fullTextData || loadingFullTextRef.current) return;

    loadingFullTextRef.current = true;
    setFullTextLoadState('loading');

    try {
      const loaded = await loadCommandMenuFullText();
      setFullTextData(loaded);
      setFullTextLoadState('ready');
    } catch (error) {
      console.error(error);
      setFullTextLoadState('error');
    } finally {
      loadingFullTextRef.current = false;
    }
  }, [fullTextData]);

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
      keywords: fullTextBySlug.has(post.slug)
        ? `${post.searchText} ${fullTextBySlug.get(post.slug)}`
        : post.searchText,
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
  }, [data.categories, data.posts, data.tags, fullTextBySlug, pathname, router]);

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
      actions={[]}
      options={{
        enableHistory: true,
        disableScrollbarManagement: true,
        animations: { enterMs: 120, exitMs: 100 },
      }}
    >
      <GlobalActionsRegistrar actions={globalActions} />
      <CommandMenuToggleBridge initialToggleToken={initialToggleToken} />
      <FullTextSearchLoader
        fullTextLoadState={fullTextLoadState}
        warmFullTextIndex={warmFullTextIndex}
      />
      <PageScopedActions pathname={pathname} headings={pageHeadings} />
      <CommandMenuPalette fullTextLoadState={fullTextLoadState} />
    </KBarProvider>
  );
}

function GlobalActionsRegistrar({ actions }: { actions: Action[] }) {
  useRegisterActions(actions, [actions]);
  return null;
}

function CommandMenuToggleBridge({
  initialToggleToken,
}: {
  initialToggleToken: number;
}) {
  const { query } = useKBar();

  useEffect(() => {
    const handleToggle = () => {
      query.toggle();
    };

    window.addEventListener(COMMAND_MENU_TOGGLE_EVENT, handleToggle);
    return () => {
      window.removeEventListener(COMMAND_MENU_TOGGLE_EVENT, handleToggle);
    };
  }, [query]);

  useEffect(() => {
    if (initialToggleToken === 0) return;

    query.setVisualState(VisualState.showing);
  }, [initialToggleToken, query]);

  return null;
}

function FullTextSearchLoader({
  fullTextLoadState,
  warmFullTextIndex,
}: {
  fullTextLoadState: FullTextLoadState;
  warmFullTextIndex: () => void;
}) {
  const { searchQuery } = useKBar((state) => ({
    searchQuery: state.searchQuery,
  }));
  const parsedSearch = useMemo(
    () => parseSearchQuery(searchQuery),
    [searchQuery],
  );

  useEffect(() => {
    if (fullTextLoadState !== 'idle') return;
    if (!shouldUseFullTextIndex(parsedSearch)) return;

    warmFullTextIndex();
  }, [fullTextLoadState, parsedSearch, warmFullTextIndex]);

  return null;
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

function CommandMenuPalette({
  fullTextLoadState,
}: {
  fullTextLoadState: FullTextLoadState;
}) {
  const { results } = useMatches();
  const { searchQuery, actions, rootActionId } = useKBar((state) => ({
    searchQuery: state.searchQuery,
    actions: state.actions,
    rootActionId: state.currentRootActionId,
  }));
  const parsedSearch = useMemo(
    () => parseSearchQuery(searchQuery),
    [searchQuery],
  );
  const visibleResults = useMemo(() => {
    if (parsedSearch.mode === 'all') {
      return results;
    }

    return getScopedResults(actions, rootActionId ?? null, parsedSearch);
  }, [actions, parsedSearch, results, rootActionId]);
  const searchStyle = containsCjk(searchQuery)
    ? { fontFamily: 'var(--font-prose)' as const }
    : undefined;
  usePrefetchVisibleRoutes(visibleResults);

  return (
    <KBarPortal>
      <KBarPositioner className="fixed inset-0 z-[90] bg-black/55 px-4 backdrop-blur-sm">
        <div
          className="mx-auto w-full max-w-[56rem]"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <KBarAnimator className="w-full overflow-hidden rounded-2xl border border-rule bg-bg-elev/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
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

            {visibleResults.length === 0 ? (
              <div className="px-4 py-6 text-sm text-fg-dim">
                {getEmptyStateMessage(parsedSearch, fullTextLoadState)}
              </div>
            ) : (
              <div className="pb-2">
                <KBarResults
                  items={visibleResults}
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
              </div>
            )}
          </KBarAnimator>
        </div>
      </KBarPositioner>
    </KBarPortal>
  );
}

function usePrefetchVisibleRoutes(results: Array<string | ActionImpl>) {
  const router = useRouter();
  const prefetched = useRef<Set<string>>(new Set());

  const hrefs = useMemo(
    () =>
      results
        .filter((item): item is ActionImpl => typeof item !== 'string')
        .map(getActionHref)
        .filter((href): href is string => Boolean(href))
        .slice(0, 6),
    [results],
  );

  useEffect(() => {
    for (const href of hrefs) {
      if (prefetched.current.has(href)) continue;
      prefetched.current.add(href);
      router.prefetch(href);
    }
  }, [hrefs, router]);
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

type SearchMode = 'all' | 'categories' | 'tags' | 'commands';

interface ParsedSearchQuery {
  mode: SearchMode;
  term: string;
}

function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmed = query.trim();
  if (!trimmed) {
    return { mode: 'all', term: '' };
  }

  const prefix = trimmed[0];
  const term = trimmed.slice(1).trim();

  switch (prefix) {
    case '@':
      return { mode: 'categories', term };
    case '#':
      return { mode: 'tags', term };
    case '>':
      return { mode: 'commands', term };
    default:
      return { mode: 'all', term: trimmed };
  }
}

function shouldUseFullTextIndex(parsedSearch: ParsedSearchQuery): boolean {
  return parsedSearch.mode === 'all' && parsedSearch.term.trim().length >= 2;
}

function getScopedResults(
  actions: Record<string, ActionImpl>,
  rootActionId: string | null,
  parsedSearch: ParsedSearchQuery,
): Array<string | ActionImpl> {
  const rootActions = getVisibleRootActions(actions, rootActionId);
  const searchableActions = collectSearchableActions(rootActions);
  const matches = searchableActions
    .filter((action) => matchesSearchMode(action, parsedSearch.mode))
    .map((action) => ({
      action,
      score: scoreAction(action, parsedSearch.term),
    }))
    .filter((entry): entry is { action: ActionImpl; score: number } => entry.score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.action.priority !== left.action.priority) {
        return right.action.priority - left.action.priority;
      }
      return left.action.name.localeCompare(right.action.name);
    });

  return groupScopedResults(matches.map((entry) => entry.action));
}

function getVisibleRootActions(
  actions: Record<string, ActionImpl>,
  rootActionId: string | null,
): ActionImpl[] {
  return Object.keys(actions)
    .reduce<ActionImpl[]>((acc, actionId) => {
      const action = actions[actionId];
      if (!action.parent && !rootActionId) {
        acc.push(action);
      }
      if (action.id === rootActionId) {
        acc.push(...action.children);
      }
      return acc;
    }, [])
    .sort((left, right) => right.priority - left.priority);
}

function collectSearchableActions(rootActions: ActionImpl[]): ActionImpl[] {
  const collected = [...rootActions];

  for (const action of rootActions) {
    if (action.children.length > 0) {
      collected.push(...collectSearchableActions(action.children));
    }
  }

  return collected;
}

function matchesSearchMode(action: ActionImpl, mode: SearchMode): boolean {
  if (mode === 'all') return true;

  const sectionName = getActionSectionName(action);

  switch (mode) {
    case 'categories':
      return sectionName === SECTIONS.categories.name;
    case 'tags':
      return sectionName === SECTIONS.tags.name;
    case 'commands':
      return (
        sectionName === SECTIONS.pages.name ||
        sectionName === SECTIONS.page.name ||
        sectionName === SECTIONS.preferences.name ||
        action.id === 'open-random-post'
      );
    default:
      return true;
  }
}

function scoreAction(action: ActionImpl, term: string): number | null {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return 1;
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  const name = action.name.toLowerCase();
  const subtitle = action.subtitle?.toLowerCase() ?? '';
  const keywords = action.keywords?.toLowerCase() ?? '';
  const breadcrumb = action.ancestors
    .map((ancestor) => ancestor.name.toLowerCase())
    .join(' / ');

  let totalScore = 0;

  for (const part of parts) {
    const termScore =
      getFieldScore(name, part, 120, 90) ??
      getFieldScore(subtitle, part, 80, 60) ??
      getFieldScore(keywords, part, 55, 40) ??
      getFieldScore(breadcrumb, part, 40, 24);

    if (termScore === null) {
      return null;
    }

    totalScore += termScore;
  }

  return totalScore;
}

function getFieldScore(
  value: string,
  term: string,
  startsWithScore: number,
  includesScore: number,
): number | null {
  if (!value) return null;
  if (value === term) return startsWithScore + 20;
  if (value.startsWith(term)) return startsWithScore;
  if (value.includes(term)) return includesScore;
  return null;
}

function getActionSectionName(action: ActionImpl): string {
  return typeof action.section === 'string'
    ? action.section
    : action.section?.name ?? '';
}

function getActionHref(action: ActionImpl): string | null {
  const sectionName = getActionSectionName(action);

  if (sectionName === SECTIONS.pages.name && action.subtitle?.startsWith('/')) {
    return action.subtitle;
  }

  if (sectionName === SECTIONS.posts.name && action.id.startsWith('post-')) {
    return `/posts/${encodeURIComponent(action.id.slice('post-'.length))}`;
  }

  if (sectionName === SECTIONS.tags.name && action.id.startsWith('tag-')) {
    return `/tags/${encodeURIComponent(action.id.slice('tag-'.length))}`;
  }

  if (
    sectionName === SECTIONS.categories.name &&
    action.id.startsWith('category-')
  ) {
    return getCategoryHref(action.id.slice('category-'.length));
  }

  return null;
}

function groupScopedResults(actions: ActionImpl[]): Array<string | ActionImpl> {
  const groups = new Map<string, ActionImpl[]>();
  const sectionMeta = new Map<string, number>();
  const ordered: Array<string | ActionImpl> = [];

  for (const action of actions) {
    const sectionName = getActionSectionName(action);
    if (!sectionName) {
      ordered.push(action);
      continue;
    }

    if (!groups.has(sectionName)) {
      groups.set(sectionName, []);
      sectionMeta.set(
        sectionName,
        typeof action.section === 'string' ? 0 : action.section?.priority ?? 0,
      );
    }

    groups.get(sectionName)!.push(action);
  }

  const groupedSections = [...groups.keys()].sort(
    (left, right) => (sectionMeta.get(right) ?? 0) - (sectionMeta.get(left) ?? 0),
  );

  for (const sectionName of groupedSections) {
    ordered.push(sectionName);
    ordered.push(...(groups.get(sectionName) ?? []));
  }

  return ordered;
}

function getEmptyStateMessage(
  parsedSearch: ParsedSearchQuery,
  fullTextLoadState: FullTextLoadState,
): string {
  if (
    shouldUseFullTextIndex(parsedSearch) &&
    fullTextLoadState === 'loading'
  ) {
    return 'loading full-text search...';
  }

  switch (parsedSearch.mode) {
    case 'categories':
      return 'no category matches. try @windows or @服务.';
    case 'tags':
      return 'no tag matches. try #minio or #choco仓库.';
    case 'commands':
      return 'no command matches. try >theme or >top.';
    default:
      return 'no matches. try a post title, tag, page, or action keyword.';
  }
}

function scrollToHeading(id: string) {
  const heading = document.getElementById(id);
  if (!heading) return;

  const offset = 104;
  const top = heading.getBoundingClientRect().top + window.scrollY - offset;
  window.history.replaceState(null, '', `#${id}`);
  window.scrollTo({ top, behavior: 'smooth' });
}
