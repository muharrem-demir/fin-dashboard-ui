import { cn } from '../lib/cn';

export interface SkeletonProps {
  readonly className?: string;
}

/**
 * One shimmering block.
 *
 * Skeletons are `aria-hidden`: a screen reader gains nothing from six pulsing rectangles, and the
 * containers that use them announce their loading state once, on the region itself.
 */
export function Skeleton({ className }: SkeletonProps): React.JSX.Element {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />;
}

/**
 * Placeholder for the portfolio grid.
 *
 * The shapes deliberately match the real card's layout — title line, two stat lines, footer — so
 * the transition to loaded content does not shift anything the eye was already tracking.
 */
export function PortfolioCardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-card border border-border-subtle bg-surface-raised p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="mt-6 flex gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-14" />
        </div>
      </div>
    </div>
  );
}

export function PortfolioListSkeleton({ count = 6 }: { readonly count?: number }): React.JSX.Element {
  return (
    <div role="status" aria-label="Loading portfolios" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <PortfolioCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Placeholder rows for the holdings table, matching its six data columns. */
export function HoldingsTableSkeleton({ rows = 5 }: { readonly rows?: number }): React.JSX.Element {
  return (
    <div role="status" aria-label="Loading holdings" className="divide-y divide-border-subtle">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid grid-cols-2 items-center gap-4 px-5 py-4 sm:grid-cols-6">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-12 justify-self-end sm:justify-self-auto" />
          <Skeleton className="hidden h-5 w-20 sm:block" />
          <Skeleton className="hidden h-5 w-16 sm:block" />
          <Skeleton className="hidden h-5 w-16 sm:block" />
          <Skeleton className="hidden h-5 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}
