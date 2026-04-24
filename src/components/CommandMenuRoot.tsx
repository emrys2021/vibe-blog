'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { CommandMenuData } from '@/lib/types';
import {
  COMMAND_MENU_IDLE_DELAY_MS,
  COMMAND_MENU_IDLE_TIMEOUT_MS,
  COMMAND_MENU_INDEX_PATH,
  COMMAND_MENU_PRELOAD_EVENT,
  COMMAND_MENU_TOGGLE_EVENT,
} from './command-menu-events';

type CommandMenuOverlayComponent = ComponentType<{
  data: CommandMenuData;
  initialToggleToken?: number;
}>;

type CommandMenuModule = typeof import('./CommandMenu');

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

let commandMenuLoadPromise:
  | Promise<{
      Component: CommandMenuOverlayComponent;
      data: CommandMenuData;
    }>
  | null = null;

function loadCommandMenu() {
  if (!commandMenuLoadPromise) {
    commandMenuLoadPromise = Promise.all([
      import('./CommandMenu') as Promise<CommandMenuModule>,
      fetch(COMMAND_MENU_INDEX_PATH, { cache: 'force-cache' }).then(
        async (response) => {
          if (!response.ok) {
            throw new Error(
              `command menu index request failed (${response.status})`,
            );
          }

          return (await response.json()) as CommandMenuData;
        },
      ),
    ]).then(([module, data]) => ({
      Component: module.CommandMenuOverlay,
      data,
    }));
  }

  return commandMenuLoadPromise;
}

export function CommandMenuRoot() {
  const [component, setComponent] = useState<CommandMenuOverlayComponent | null>(
    null,
  );
  const [data, setData] = useState<CommandMenuData | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [pendingToggleCount, setPendingToggleCount] = useState(0);
  const [initialToggleToken, setInitialToggleToken] = useState(0);
  const loadingRef = useRef(false);

  const warmCommandMenu = useCallback(async () => {
    if (component && data) return;
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoadState((current) => (current === 'ready' ? current : 'loading'));

    try {
      const loaded = await loadCommandMenu();
      setComponent(() => loaded.Component);
      setData(loaded.data);
      setLoadState('ready');
    } catch (error) {
      console.error(error);
      setLoadState('error');
    } finally {
      loadingRef.current = false;
    }
  }, [component, data]);

  useEffect(() => {
    if (!component || !data || pendingToggleCount === 0) return;

    if (pendingToggleCount % 2 === 1) {
      setInitialToggleToken((token) => token + 1);
    }

    setPendingToggleCount(0);
  }, [component, data, pendingToggleCount]);

  useEffect(() => {
    const handlePreload = () => {
      void warmCommandMenu();
    };

    const handleToggle = () => {
      if (component && data) return;
      setPendingToggleCount((count) => count + 1);
      void warmCommandMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (component && data) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') {
        return;
      }

      event.preventDefault();
      setPendingToggleCount((count) => count + 1);
      void warmCommandMenu();
    };

    window.addEventListener(COMMAND_MENU_PRELOAD_EVENT, handlePreload);
    window.addEventListener(COMMAND_MENU_TOGGLE_EVENT, handleToggle);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener(COMMAND_MENU_PRELOAD_EVENT, handlePreload);
      window.removeEventListener(COMMAND_MENU_TOGGLE_EVENT, handleToggle);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [component, data, warmCommandMenu]);

  useEffect(() => {
    const idleWindow = window as WindowWithIdleCallback;

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(
        () => {
          void warmCommandMenu();
        },
        { timeout: COMMAND_MENU_IDLE_TIMEOUT_MS },
      );

      return () => {
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const timer = window.setTimeout(() => {
      void warmCommandMenu();
    }, COMMAND_MENU_IDLE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [warmCommandMenu]);

  const showLoadingFallback =
    pendingToggleCount % 2 === 1 && loadState !== 'ready';

  return (
    <>
      {component && data ? (() => {
        const Overlay = component;
        return <Overlay data={data} initialToggleToken={initialToggleToken} />;
      })() : null}

      {showLoadingFallback ? (
        <div className="fixed inset-0 z-[88] bg-black/45 px-4 backdrop-blur-sm">
          <div className="mx-auto mt-[10vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-rule bg-bg-elev/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="border-b border-rule px-4 pb-3 pt-4">
              <div className="text-[10px] uppercase tracking-[0.28em] text-fg-dim">
                command palette
              </div>
            </div>
            <div className="px-4 py-6 text-sm text-fg-dim">
              {loadState === 'error' ? 'search is temporarily unavailable.' : 'loading search…'}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
