'use client';

import { useEffect, useState } from 'react';
import { useKBar } from 'kbar';

export function CommandMenuToggle() {
  const { query } = useKBar();
  const [modifier, setModifier] = useState('Ctrl');

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform ?? navigator.platform ?? '';
    setModifier(/mac|iphone|ipad|ipod/i.test(platform) ? 'Cmd' : 'Ctrl');
  }, []);

  return (
    <button
      type="button"
      onClick={query.toggle}
      aria-label="open command palette"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rule bg-bg-elev/45 px-2 text-[11px] text-fg-dim transition-colors hover:border-accent hover:text-accent"
      title={`${modifier} + K`}
    >
      <span className="hidden md:inline">search</span>
      <span className="inline-flex items-center gap-1 rounded border border-rule px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
        <span>{modifier}</span>
        <span>K</span>
      </span>
    </button>
  );
}
