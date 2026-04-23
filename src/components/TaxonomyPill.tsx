import Link from 'next/link';

type TaxonomyVariant = 'category' | 'tag';

const stylesByVariant: Record<
  TaxonomyVariant,
  {
    marker: string;
    markerClass: string;
    idleClass: string;
    activeClass: string;
  }
> = {
  category: {
    marker: '@',
    markerClass: 'text-accent',
    idleClass: 'border-rule hover:border-accent hover:text-accent',
    activeClass:
      'border-accent shadow-[0_0_0_1px_rgba(126,231,135,0.18),0_0_18px_rgba(126,231,135,0.08)]',
  },
  tag: {
    marker: '#',
    markerClass: 'text-accent-2',
    idleClass: 'border-rule hover:border-accent-2 hover:text-accent-2',
    activeClass:
      'border-accent-2 shadow-[0_0_0_1px_rgba(121,192,255,0.18),0_0_18px_rgba(121,192,255,0.08)]',
  },
};

function pillClassName(variant: TaxonomyVariant, active: boolean, className?: string) {
  const variantStyle = stylesByVariant[variant];
  return [
    'group inline-flex max-w-full items-stretch overflow-hidden rounded-md border bg-bg-elev/70 transition-all duration-150 hover:-translate-y-px',
    active ? variantStyle.activeClass : variantStyle.idleClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function Inner({
  label,
  count,
  variant,
}: {
  label: string;
  count?: number;
  variant: TaxonomyVariant;
}) {
  const variantStyle = stylesByVariant[variant];

  return (
    <>
      <span
        className="min-w-0 px-3 py-1.5 text-[0.95rem] leading-none whitespace-normal break-all"
        style={{ fontFamily: 'var(--font-prose)' }}
      >
        <span className={variantStyle.markerClass}>{variantStyle.marker}</span>
        {label}
      </span>
      {typeof count === 'number' ? (
        <span className="border-l border-rule px-2.5 py-1.5 text-[11px] text-fg-dim tabular-nums">
          {count}
        </span>
      ) : null}
    </>
  );
}

export function TaxonomyPill({
  label,
  href,
  count,
  variant,
  active = false,
  className,
}: {
  label: string;
  href?: string;
  count?: number;
  variant: TaxonomyVariant;
  active?: boolean;
  className?: string;
}) {
  const classes = pillClassName(variant, active, className);

  if (href) {
    return (
      <Link href={href} className={classes} aria-current={active ? 'page' : undefined}>
        <Inner label={label} count={count} variant={variant} />
      </Link>
    );
  }

  return (
    <span className={classes}>
      <Inner label={label} count={count} variant={variant} />
    </span>
  );
}
