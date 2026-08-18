import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface EmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  /** A call to action, so an empty list is a starting point rather than a dead end. */
  readonly action?: ReactNode;
  readonly className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 px-6 py-16 text-center', className)}>
      <div
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-surface-sunken text-content-muted ring-1 ring-border-subtle ring-inset"
      >
        {icon}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-base font-semibold text-content-primary">{title}</p>
        {description !== undefined && <p className="max-w-sm text-sm text-content-secondary">{description}</p>}
      </div>

      {action}
    </div>
  );
}
