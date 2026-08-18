import { Link } from 'react-router-dom';

import { EmptyState } from '../shared/ui/EmptyState';
import { Search } from '../shared/ui/icons';

export function NotFoundPage(): React.JSX.Element {
  return (
    <EmptyState
      icon={<Search className="size-7" />}
      title="Page not found"
      description="The link you followed does not lead anywhere in this dashboard."
      className="rounded-card border border-border-subtle bg-surface-raised"
      action={
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400"
        >
          Back to portfolios
        </Link>
      }
    />
  );
}
