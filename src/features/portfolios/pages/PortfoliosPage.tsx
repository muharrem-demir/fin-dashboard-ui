import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { Briefcase, Plus, RefreshCw } from '../../../shared/ui/icons';
import { PortfolioListSkeleton } from '../../../shared/ui/Skeleton';
import { formatCount } from '../../../shared/lib/format';
import { WatchlistSection } from '../../watchlist/components/WatchlistSection';
import { useCreatePortfolio, useDeletePortfolio, usePortfolios } from '../api/portfolio-queries';
import type { PortfolioSummary } from '../api/portfolio-schemas';
import { CreatePortfolioDialog } from '../components/CreatePortfolioDialog';
import { PortfolioCard } from '../components/PortfolioCard';

/**
 * The landing page: every portfolio, with create and delete, and the watchlist beneath them.
 *
 * Creating navigates straight to the new portfolio's detail page, which is both the requirement and
 * the right default — a portfolio's whole purpose is the holdings you are about to add to it.
 *
 * The watchlist is one element here and nothing more. It fetches its own entries and owns its own live
 * connection, so this page neither knows nor cares that a socket opens while it is on screen.
 */
export function PortfoliosPage(): React.JSX.Element {
  const navigate = useNavigate();
  const portfolios = usePortfolios();
  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<PortfolioSummary | null>(null);

  const create = useCallback(
    (name: string) => {
      createPortfolio.mutate(name, {
        onSuccess: (portfolio) => {
          setCreateOpen(false);
          void navigate(`/portfolios/${portfolio.id}`);
        },
      });
    },
    [createPortfolio, navigate],
  );

  const confirmDeletion = useCallback(() => {
    if (pendingDeletion === null) {
      return;
    }

    deletePortfolio.mutate(
      { portfolioId: pendingDeletion.id, name: pendingDeletion.name },
      {
        // Closed on settle rather than on success: leaving the dialog open on failure keeps the
        // error next to the action that caused it, and the toast explains why.
        onSuccess: () => {
          setPendingDeletion(null);
        },
      },
    );
  }, [deletePortfolio, pendingDeletion]);

  const list = portfolios.data ?? [];

  return (
    // `flex-1` claims the shell's leftover height and `mt-auto` on the watchlist spends it, so the
    // strip sits at the foot of the screen even when the portfolios above it do not fill it.
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content-primary sm:text-3xl">Portfolios</h1>
          <p className="mt-1 text-sm text-content-secondary">
            {portfolios.isSuccess
              ? list.length === 0
                ? 'Create one to start tracking holdings.'
                : `${formatCount(list.length)} ${list.length === 1 ? 'portfolio' : 'portfolios'}, tracking live market prices.`
              : 'Loading your portfolios…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {portfolios.isSuccess && (
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              loading={portfolios.isFetching}
              onClick={() => {
                void portfolios.refetch();
              }}
            >
              Refresh
            </Button>
          )}

          <Button
            icon={<Plus className="size-4" />}
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            New portfolio
          </Button>
        </div>
      </header>

      {portfolios.isPending ? (
        <PortfolioListSkeleton />
      ) : portfolios.isError ? (
        <ErrorState
          error={portfolios.error}
          title="Could not load your portfolios"
          retrying={portfolios.isFetching}
          onRetry={() => {
            void portfolios.refetch();
          }}
          className="rounded-card border border-border-subtle bg-surface-raised"
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-7" />}
          title="No portfolios available"
          description="Portfolios group the stocks you want to watch together. Create your first one to get started."
          className="rounded-card border border-dashed border-border-strong bg-surface-raised"
          action={
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              Create a portfolio
            </Button>
          }
        />
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((portfolio) => (
            <li key={portfolio.id}>
              <PortfolioCard
                portfolio={portfolio}
                onDelete={setPendingDeletion}
                deleting={deletePortfolio.isPending && deletePortfolio.variables.portfolioId === portfolio.id}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Mounted only while open, so its fields start empty every time without a reset effect. */}
      {createOpen && (
        <CreatePortfolioDialog
          submitting={createPortfolio.isPending}
          onClose={() => {
            setCreateOpen(false);
          }}
          onSubmit={create}
        />
      )}

      {/*
        Docked to the foot of the viewport: `mt-auto` drops it to the bottom on a short page, and
        `sticky bottom-0` keeps it there while a long list of portfolios scrolls behind it. Sticky
        rather than fixed, for the reason AppLayout gives for its header — a fixed bar has to be paid
        for with padding somewhere else, and the two drift apart the moment the bar changes height.
        Scrolled to the very end it settles into flow, so it never covers the footer.

        The negative margins bleed the band through the layout's own padding, so it reads as one strip
        across the column rather than a floating card.
      */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-auto border-t border-border-subtle bg-surface-base px-4 pt-4 pb-6 sm:-mx-6 sm:-mb-8 sm:px-6 sm:pb-8 lg:-mx-8 lg:px-8">
        <WatchlistSection />
      </div>

      <ConfirmDialog
        open={pendingDeletion !== null}
        title="Delete this portfolio?"
        confirmLabel="Delete portfolio"
        loading={deletePortfolio.isPending}
        onConfirm={confirmDeletion}
        onCancel={() => {
          setPendingDeletion(null);
        }}
      >
        <p className="text-sm text-content-secondary">
          <span className="font-semibold text-content-primary">{pendingDeletion?.name}</span> and all{' '}
          {formatCount(pendingDeletion?.stockCount ?? 0)} of its holdings will be permanently removed. This cannot be
          undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
