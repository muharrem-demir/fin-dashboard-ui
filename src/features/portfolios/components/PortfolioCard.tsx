import { Link } from 'react-router-dom';

import { formatCount } from '../../../shared/lib/format';
import { ChevronRight, Trash2, Wallet } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import type { PortfolioSummary } from '../api/portfolio-schemas';

export interface PortfolioCardProps {
  readonly portfolio: PortfolioSummary;
  readonly onDelete: (portfolio: PortfolioSummary) => void;
  readonly deleting?: boolean;
}

/**
 * One portfolio in the landing grid.
 *
 * The whole card is a link, with the delete control layered above it. That gives a large, forgiving
 * touch target for the common action on a phone while keeping the destructive one deliberately small
 * — and `stopPropagation` on the delete button is what stops a tap on the bin from also navigating.
 */
export function PortfolioCard({ portfolio, onDelete, deleting = false }: PortfolioCardProps): React.JSX.Element {
  return (
    <div className="group relative rounded-card border border-border-subtle bg-surface-raised shadow-card transition-all duration-200 hover:border-brand-400 hover:shadow-pop focus-within:border-brand-400">
      <Link
        to={`/portfolios/${portfolio.id}`}
        className="flex flex-col gap-5 rounded-card p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        aria-label={`Open ${portfolio.name}`}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400"
          >
            <Wallet className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            {/* `break-words` because a portfolio name may be 100 characters with no spaces. */}
            <h3 className="truncate text-base font-semibold text-content-primary group-hover:text-brand-600 dark:group-hover:text-brand-400">
              {portfolio.name}
            </h3>
            <p className="mt-0.5 text-xs text-content-muted">
              {portfolio.stockCount === 0 ? 'No holdings yet' : 'Tap to view holdings'}
            </p>
          </div>

          {/* Padded out so the icon does not sit under the delete button in the corner. */}
          <span
            aria-hidden="true"
            className="mt-1 mr-9 text-content-muted transition-transform group-hover:translate-x-0.5"
          >
            <ChevronRight className="size-4" />
          </span>
        </div>

        <dl className="flex gap-8">
          <div>
            <dt className="text-xs font-medium tracking-wide text-content-muted uppercase">Stocks</dt>
            <dd className="numeric mt-1 text-xl font-semibold text-content-primary">
              {formatCount(portfolio.stockCount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-content-muted uppercase">Total shares</dt>
            <dd className="numeric mt-1 text-xl font-semibold text-content-primary">
              {formatCount(portfolio.totalShares)}
            </dd>
          </div>
        </dl>
      </Link>

      <div className="absolute right-3 top-3">
        <IconButton
          label={`Delete ${portfolio.name}`}
          icon={<Trash2 className="size-4" />}
          variant="danger-ghost"
          loading={deleting}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(portfolio);
          }}
        />
      </div>
    </div>
  );
}
