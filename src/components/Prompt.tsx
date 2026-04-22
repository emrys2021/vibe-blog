import type { ReactNode } from 'react';

/**
 * Renders a faux shell prompt: `$ <children>` with an accent-colored `$`.
 */
export function Prompt({ children, cursor }: { children: ReactNode; cursor?: boolean }) {
  return (
    <span>
      <span className="text-accent select-none">$ </span>
      <span className={cursor ? 'cursor' : undefined}>{children}</span>
    </span>
  );
}
