'use client';

import { useEffect, useState } from 'react';

const ARTICLE_SELECTOR = 'article[data-post-article]';
const HEADER_SELECTOR = 'header[data-site-header]';
const HEADING_SELECTOR = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]';
const CODE_FIGURE_SELECTOR = 'figure[data-rehype-pretty-code-figure]';
const IMAGE_SELECTOR = '.prose img';
const COLLAPSIBLE_CODE_LINE_THRESHOLD = 32;
const COLLAPSED_CODE_VISIBLE_LINES = 22;

interface LightboxImage {
  src: string;
  alt: string;
}

export function PostEnhancements() {
  const [progress, setProgress] = useState(0);
  const [headerOffset, setHeaderOffset] = useState(57);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>(ARTICLE_SELECTOR);
    if (!article) return;

    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      setProgress(getReadingProgress(article));
    };

    const scheduleUpdate = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(HEADER_SELECTOR);
    if (!header) return;

    const update = () => {
      setHeaderOffset(Math.round(header.getBoundingClientRect().height));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>(ARTICLE_SELECTOR);
    if (!article) return;

    const cleanups: Array<() => void> = [];

    for (const heading of article.querySelectorAll<HTMLElement>(HEADING_SELECTOR)) {
      const cleanup = enhanceHeading(heading);
      if (cleanup) cleanups.push(cleanup);
    }

    for (const figure of article.querySelectorAll<HTMLElement>(CODE_FIGURE_SELECTOR)) {
      const cleanup = enhanceCodeFigure(figure);
      if (cleanup) cleanups.push(cleanup);
    }

    for (const image of article.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR)) {
      const cleanup = enhanceImage(image, setLightboxImage);
      if (cleanup) cleanups.push(cleanup);
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  useEffect(() => {
    if (!lightboxImage) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxImage]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 z-[35] h-[2px] bg-rule/35"
        style={{ top: `${headerOffset}px` }}
      >
        <div
          className="h-full origin-left bg-accent transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {lightboxImage ? (
        <div
          className="post-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.alt || 'Image preview'}
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            className="post-image-lightbox-close"
            aria-label="Close image preview"
            onClick={() => setLightboxImage(null)}
          >
            esc
          </button>
          <div
            className="post-image-lightbox-frame"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="post-image-lightbox-image"
            />
            {lightboxImage.alt ? (
              <div className="post-image-lightbox-caption">
                {lightboxImage.alt}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function enhanceHeading(heading: HTMLElement) {
  if (heading.querySelector('.heading-share-button')) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'heading-share-button';
  button.textContent = '#';
  button.title = 'Copy section link';
  button.setAttribute(
    'aria-label',
    `Copy link to ${heading.textContent?.trim() || 'section'}`,
  );

  const handleClick = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!heading.id) return;
    const url = new URL(window.location.href);
    url.hash = heading.id;
    const copied = await copyText(url.toString());
    flashTextLabel(button, copied ? '✓' : '!', '#');
  };

  button.addEventListener('click', handleClick);
  heading.appendChild(button);

  return () => {
    button.removeEventListener('click', handleClick);
    button.remove();
  };
}

function enhanceCodeFigure(figure: HTMLElement) {
  if (figure.querySelector('.code-copy-action')) return null;

  const pre = figure.querySelector<HTMLPreElement>('pre');
  const code = pre?.querySelector<HTMLElement>('code');
  if (!pre || !code) return null;

  const title = figure.querySelector<HTMLElement>('[data-rehype-pretty-code-title]');
  const language = formatLanguageLabel(
    pre.dataset.language || code.dataset.language || 'code',
  );
  const rawCode = normalizeCodeText(code.textContent ?? '');
  const collapseCleanup = enhanceCollapsibleCodeFigure(
    figure,
    getCodeLineCount(rawCode),
  );

  const actionButton = createCodeActionButton(language);
  actionButton.setAttribute('aria-label', `Copy ${language} code block`);

  const handleClick = async () => {
    const copied = rawCode ? await copyText(rawCode) : false;
    flashActionLabel(actionButton, copied ? 'copied' : 'error');
  };
  const handlePointerEnter = () => setCodeActionLabel(actionButton, 'hover');
  const handlePointerLeave = () => setCodeActionLabel(actionButton, 'default');
  const handleFocus = () => setCodeActionLabel(actionButton, 'hover');
  const handleBlur = () => setCodeActionLabel(actionButton, 'default');

  actionButton.addEventListener('click', handleClick);
  actionButton.addEventListener('pointerenter', handlePointerEnter);
  actionButton.addEventListener('pointerleave', handlePointerLeave);
  actionButton.addEventListener('focus', handleFocus);
  actionButton.addEventListener('blur', handleBlur);

  if (title) {
    title.classList.add('code-title-enhanced');
    title.appendChild(actionButton);
  } else {
    figure.classList.add('code-block-with-action');
    figure.appendChild(actionButton);
  }

  return () => {
    actionButton.removeEventListener('click', handleClick);
    actionButton.removeEventListener('pointerenter', handlePointerEnter);
    actionButton.removeEventListener('pointerleave', handlePointerLeave);
    actionButton.removeEventListener('focus', handleFocus);
    actionButton.removeEventListener('blur', handleBlur);
    actionButton.remove();
    title?.classList.remove('code-title-enhanced');
    figure.classList.remove('code-block-with-action');
    collapseCleanup?.();
  };
}

function enhanceCollapsibleCodeFigure(figure: HTMLElement, lineCount: number) {
  if (lineCount <= COLLAPSIBLE_CODE_LINE_THRESHOLD) return null;
  if (figure.querySelector('.code-collapse-toggle')) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-collapse-toggle';
  figure.classList.add('code-block-collapsible', 'code-block-collapsed');
  figure.style.setProperty(
    '--code-collapsed-lines',
    String(COLLAPSED_CODE_VISIBLE_LINES),
  );

  const update = () => {
    const collapsed = figure.classList.contains('code-block-collapsed');
    button.textContent = collapsed ? `expand ${lineCount} lines` : 'collapse';
    button.setAttribute('aria-expanded', String(!collapsed));
  };

  const handleClick = () => {
    figure.classList.toggle('code-block-collapsed');
    update();
  };

  button.addEventListener('click', handleClick);
  update();
  figure.appendChild(button);

  return () => {
    button.removeEventListener('click', handleClick);
    button.remove();
    figure.classList.remove('code-block-collapsible', 'code-block-collapsed');
    figure.style.removeProperty('--code-collapsed-lines');
  };
}

function enhanceImage(
  image: HTMLImageElement,
  openLightbox: (image: LightboxImage | null) => void,
) {
  if (!image.src || image.closest('a')) return null;

  image.classList.add('post-image-preview');
  image.tabIndex = 0;
  image.setAttribute('role', 'button');
  image.setAttribute(
    'aria-label',
    image.alt
      ? `Open image preview: ${image.alt}`
      : 'Open image preview',
  );
  image.setAttribute('title', image.alt || 'Click to enlarge');

  const open = () => {
    openLightbox({
      src: image.currentSrc || image.src,
      alt: image.alt || '',
    });
  };

  const handleClick = () => open();
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };

  image.addEventListener('click', handleClick);
  image.addEventListener('keydown', handleKeyDown);

  return () => {
    image.removeEventListener('click', handleClick);
    image.removeEventListener('keydown', handleKeyDown);
    image.classList.remove('post-image-preview');
    image.removeAttribute('role');
    image.removeAttribute('aria-label');
    image.removeAttribute('title');
    image.removeAttribute('tabindex');
  };
}

function getReadingProgress(article: HTMLElement): number {
  const rect = article.getBoundingClientRect();
  const articleTop = window.scrollY + rect.top;
  const start = articleTop - 120;
  const end = articleTop + article.offsetHeight - window.innerHeight * 0.4;
  const distance = Math.max(end - start, 1);
  const current = window.scrollY - start;

  return clamp(current / distance, 0, 1);
}

function normalizeCodeText(value: string): string {
  return value.replace(/\n$/, '');
}

function getCodeLineCount(value: string): number {
  if (!value) return 0;
  return value.split('\n').length;
}

function formatLanguageLabel(value: string): string {
  const lower = value.toLowerCase();

  switch (lower) {
    case 'plaintext':
      return 'text';
    case 'shellscript':
      return 'shell';
    case 'typescript':
      return 'ts';
    case 'javascript':
      return 'js';
    default:
      return lower;
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return copyTextFallback(value);
  }
}

function copyTextFallback(value: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function createCodeActionButton(language: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy-action';
  button.dataset.feedback = '';
  button.dataset.defaultLabel = language;
  button.dataset.hoverLabel = 'copy';
  button.dataset.copiedLabel = 'copied';
  button.dataset.errorLabel = 'error';

  const label = document.createElement('span');
  label.className = 'code-action-label';
  label.textContent = language;

  button.append(label);
  return button;
}

function flashTextLabel(
  element: HTMLButtonElement,
  activeLabel: string,
  defaultLabel: string,
) {
  const timerKey = '__labelTimer';
  const host = element as HTMLButtonElement & {
    [timerKey]?: number;
  };

  if (host[timerKey]) {
    window.clearTimeout(host[timerKey]);
  }

  element.textContent = activeLabel;
  host[timerKey] = window.setTimeout(() => {
    element.textContent = defaultLabel;
  }, 1400);
}

function flashActionLabel(element: HTMLButtonElement, activeLabel: string) {
  const timerKey = '__labelTimer';
  const host = element as HTMLButtonElement & {
    [timerKey]?: number;
  };

  if (host[timerKey]) {
    window.clearTimeout(host[timerKey]);
  }

  element.dataset.feedback = activeLabel;
  setButtonLabel(element, getCodeActionLabelByState(element, activeLabel));
  host[timerKey] = window.setTimeout(() => {
    element.dataset.feedback = '';
    setCodeActionLabel(
      element,
      element.matches(':hover, :focus, :focus-visible') ? 'hover' : 'default',
    );
  }, 1400);
}

function setCodeActionLabel(
  element: HTMLButtonElement,
  state: 'default' | 'hover',
) {
  if (element.dataset.feedback) return;
  setButtonLabel(element, getCodeActionLabelByState(element, state));
}

function getCodeActionLabelByState(
  element: HTMLButtonElement,
  state: string,
): string {
  switch (state) {
    case 'hover':
      return element.dataset.hoverLabel || 'copy';
    case 'copied':
      return element.dataset.copiedLabel || 'copied';
    case 'error':
      return element.dataset.errorLabel || 'error';
    default:
      return element.dataset.defaultLabel || 'code';
  }
}

function setButtonLabel(element: HTMLButtonElement, label: string) {
  const text = element.querySelector<HTMLElement>('.code-action-label');
  if (!text) return;
  text.textContent = label;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
