import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { isApiError } from '../../../shared/api/api-error';
import { Button } from '../../../shared/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { ArrowLeft, EmptyInboxIcon, MarketIcon, Pencil, RefreshCw, Search } from '../../../shared/ui/icons';
import { HoldingsTableSkeleton, Skeleton } from '../../../shared/ui/Skeleton';
import { useToast } from '../../../shared/ui/toast/useToast';
import { formatCurrency } from '../../../shared/lib/format';
import { MAX_TICKERS_PER_REQUEST } from '../../quotes/api/quote-schemas';
import { useAddStock, usePortfolio, useRemoveStock, useRenamePortfolio } from '../../portfolios/api/portfolio-queries';
import { AddStockForm } from '../components/AddStockForm';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { HoldingsSearch } from '../components/HoldingsSearch';
import { HoldingsTable } from '../components/HoldingsTable';
import { PortfolioStats } from '../components/PortfolioStats';
import { RemoveStockForm } from '../components/RemoveStockForm';
import { RenamePortfolioDialog } from '../components/RenamePortfolioDialog';
import { useLiveHoldings } from '../hooks/useLiveHoldings';
import { filterHoldings } from '../lib/filter-holdings';

/**
 * A portfolio's holdings, priced live.
 *
 * The page owns the flow and delegates the hard parts: {@link useLiveHoldings} merges the REST batch
 * with the WebSocket feed, and the components below render what it produces. What is left here is the
 * sequencing — load the portfolio, confirm destructive actions, keep the header honest about whether
 * prices are moving.
 */
export function PortfolioDetailPage(): React.JSX.Element {
  const { portfolioId = '' } = useParams<{ portfolioId: string }>();

  const toast = useToast();
  const portfolio = usePortfolio(portfolioId);
  const addStock = useAddStock(portfolioId);
  const removeStock = useRemoveStock(portfolioId);
  const renamePortfolio = useRenamePortfolio(portfolioId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const stocks = portfolio.data?.stocks;
  const live = useLiveHoldings(stocks);

  const heldTickers = live.holdings.map((holding) => holding.ticker);

  /**
   * The filter is a view over the holdings, never a replacement for them: the subscription, the batch
   * request and the totals above the table all keep reading `live.holdings`, so searching hides rows
   * without unsubscribing a symbol or making the portfolio look smaller than it is.
   */
  const visibleHoldings = filterHoldings(live.holdings, search);
  const atSubscriptionCap = heldTickers.length >= MAX_TICKERS_PER_REQUEST;

  const add = useCallback(
    (ticker: string, shares: number) => {
      addStock.mutate({ ticker, shares });
    },
    [addStock],
  );

  /** A symbol the portfolio does not hold never reaches the API — it is a typo, not a request. */
  const reportMissing = useCallback(
    (ticker: string) => {
      toast.error(`${ticker} is not in this portfolio`, {
        description:
          heldTickers.length === 0
            ? 'This portfolio has no holdings yet.'
            : `Currently held: ${heldTickers.slice(0, 8).join(', ')}${heldTickers.length > 8 ? '…' : ''}.`,
      });
    },
    [heldTickers, toast],
  );

  const confirmRemoval = useCallback(() => {
    if (pendingRemoval === null) {
      return;
    }

    removeStock.mutate(pendingRemoval, {
      onSuccess: () => {
        setPendingRemoval(null);
      },
    });
  }, [pendingRemoval, removeStock]);

  const rename = useCallback(
    (name: string) => {
      renamePortfolio.mutate(name, {
        onSuccess: () => {
          setRenameOpen(false);
        },
      });
    },
    [renamePortfolio],
  );

  if (portfolio.isError) {
    const notFound = isApiError(portfolio.error) && portfolio.error.isNotFound;

    return (
      <Card>
        <ErrorState
          error={portfolio.error}
          title={notFound ? 'This portfolio no longer exists' : 'Could not load this portfolio'}
          retrying={portfolio.isFetching}
          onRetry={
            notFound
              ? undefined
              : () => {
                  void portfolio.refetch();
                }
          }
        />
        <div className="flex justify-center pb-8">
          {/* A link, not a button: this navigates, so it should be middle-clickable and copyable. */}
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-4 text-sm font-medium text-content-primary transition-colors hover:bg-surface-hover"
          >
            <ArrowLeft className="size-4" />
            Back to portfolios
          </Link>
        </div>
      </Card>
    );
  }

  const removalHolding = live.holdings.find((holding) => holding.ticker === pendingRemoval);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-content-secondary transition-colors hover:text-brand-600 dark:hover:text-brand-400"
        >
          <ArrowLeft className="size-4" />
          All portfolios
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {portfolio.isPending ? (
              <Skeleton className="h-9 w-56" />
            ) : (
              <h1 className="truncate text-2xl font-semibold tracking-tight text-content-primary sm:text-3xl">
                {portfolio.data.name}
              </h1>
            )}

            {portfolio.isSuccess && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="size-3.5" />}
                onClick={() => {
                  setRenameOpen(true);
                }}
              >
                Rename
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ConnectionBadge status={live.connectionStatus} lastTickAt={live.lastTickAt} />

            {portfolio.isSuccess && (
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="size-4" />}
                loading={portfolio.isFetching}
                onClick={() => {
                  void portfolio.refetch();
                }}
              >
                Refresh
              </Button>
            )}
          </div>
        </div>
      </header>

      <Card className="overflow-hidden">
        {portfolio.isPending ? (
          <>
            <div className="grid grid-cols-2 gap-4 border-b border-border-subtle p-5 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ))}
            </div>
            <HoldingsTableSkeleton />
          </>
        ) : (
          <>
            <PortfolioStats
              stockCount={portfolio.data.stockCount}
              totalShares={portfolio.data.totalShares}
              totalValue={live.totalValue}
              valueIsComplete={live.valueIsComplete}
              pricedCount={live.pricedCount}
              dayChangePercent={live.dayChangePercent}
            />

            {live.holdings.length === 0 ? (
              <EmptyState
                icon={<EmptyInboxIcon className="size-7" />}
                title="No stocks available"
                description="Add a ticker and a number of shares below to start tracking this portfolio's value."
              />
            ) : (
              <>
                {/* The batch request failing is not fatal — the stream may still deliver prices — so
                    this is an inline notice above a usable table, not a replacement for it. */}
                {live.quotesError !== null && live.quotesError !== undefined && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-5 py-3">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Prices could not be loaded. Shares are accurate; values will fill in if the live feed recovers.
                    </p>
                    <Button variant="secondary" size="sm" loading={live.quotesLoading} onClick={live.retryQuotes}>
                      Retry prices
                    </Button>
                  </div>
                )}

                <HoldingsSearch
                  value={search}
                  onChange={setSearch}
                  matchCount={visibleHoldings.length}
                  totalCount={live.holdings.length}
                />

                {visibleHoldings.length === 0 ? (
                  <EmptyState
                    icon={<Search className="size-7" />}
                    title="No matching stocks"
                    description={`No ticker in this portfolio contains "${search.trim()}". Clear the search to see all ${String(live.holdings.length)} holdings.`}
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch('');
                        }}
                      >
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <HoldingsTable
                    holdings={visibleHoldings}
                    onRemove={setPendingRemoval}
                    removingTicker={removeStock.isPending ? removeStock.variables : null}
                    historyPending={live.quotesLoading}
                  />
                )}
              </>
            )}
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add a stock</CardTitle>
            <span aria-hidden="true" className="text-content-muted">
              <MarketIcon className="size-5" />
            </span>
          </CardHeader>
          <CardBody>
            <AddStockForm onSubmit={add} submitting={addStock.isPending} disabled={atSubscriptionCap} />
            <p className="mt-3 text-xs text-content-muted">
              {atSubscriptionCap
                ? `This portfolio holds the maximum of ${String(MAX_TICKERS_PER_REQUEST)} tickers the live feed can watch.`
                : 'Adding a ticker you already hold increases that position rather than replacing it.'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Remove a stock</CardTitle>
          </CardHeader>
          <CardBody>
            <RemoveStockForm
              heldTickers={heldTickers}
              onFound={setPendingRemoval}
              onMissing={reportMissing}
              submitting={removeStock.isPending}
            />
          </CardBody>
        </Card>
      </div>

      {renameOpen && portfolio.isSuccess && (
        <RenamePortfolioDialog
          currentName={portfolio.data.name}
          submitting={renamePortfolio.isPending}
          onClose={() => {
            setRenameOpen(false);
          }}
          onSubmit={rename}
        />
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={`Remove ${pendingRemoval ?? ''}?`}
        confirmLabel="Remove stock"
        loading={removeStock.isPending}
        onConfirm={confirmRemoval}
        onCancel={() => {
          setPendingRemoval(null);
        }}
      >
        <p className="text-sm text-content-secondary">
          {removalHolding === undefined ? (
            <>This position will be removed from the portfolio.</>
          ) : (
            <>
              <span className="font-semibold text-content-primary">
                {removalHolding.shares} {removalHolding.shares === 1 ? 'share' : 'shares'} of {removalHolding.ticker}
              </span>
              {removalHolding.totalValue !== undefined && <> — currently {formatCurrency(removalHolding.totalValue)}</>}{' '}
              will be removed from this portfolio.
            </>
          )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
