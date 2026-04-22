import type { ReactNode } from 'react';

type Width = 'narrow' | 'wide';

const widthClass: Record<Width, string> = {
  narrow: 'max-w-3xl',
  wide: 'max-w-5xl',
};

/**
 * Page-level wrapper. Layout's `<main>` is full-width; every page chooses
 * its own column width via this component.
 */
export function Container({
  children,
  width = 'narrow',
  className = '',
}: {
  children: ReactNode;
  width?: Width;
  className?: string;
}) {
  return (
    <div className={`${widthClass[width]} mx-auto px-5 sm:px-6 py-10 ${className}`}>
      {children}
    </div>
  );
}
