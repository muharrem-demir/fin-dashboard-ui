import { useCallback, useId, useState } from 'react';

import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EyeOff, Plus } from '../../../shared/ui/icons';
import { WatchlistSkeleton } from '../../../shared/ui/Skeleton';
import { useAddWatchlistEntry, useRemoveWatchlistEntry, useWatchlist } from '../api/watchlist-queries';
import { useLiveWatchlist } from '../hooks/useLiveWatchlist';
import type { WatchedItem } from '../lib/watched-quotes';

import { AddWatchDialog } from './AddWatchDialog';
import { WatchlistCard } from './WatchlistCard';
import { WatchlistScroller } from './WatchlistScroller';

/**
 * The watchlist strip at the foot of the portfolio list.
 *
 * Self-contained on purpose: it fetches its own entries, holds its own live connection and owns its own
 * dialogs, so the page above it adds one element and knows nothing about quotes. That is also what keeps
 * the socket's lifetime tied to something meaningful — this section is on screen exactly when the
 * connection should be open.
 *
 * Removal is confirmed rather than immediate. It is a small destructive action next to a small button,
 * which is precisely the combination that gets clicked by accident.
 */
export function WatchlistSection(): React.JSX.Element {
  const headingId = useId();
  const watchlist = useWatchlist();
  const addEntry = useAddWatchlistEntry();
  const removeEntry = useRemoveWatchlistEntry();

  // Entries come from the query cache; prices are merged over them by the feed. The cards are derived,
  // never stored, so there is only ever one copy of a price.
  const { items } = useLiveWatchlist(watchlist.data);

  const [addOpen, setAddOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<WatchedItem | null>(null);

  const add = useCallback(
    (ticker: string) => {
      addEntry.mutate(ticker, {
        // Closed on success only: a rejected symbol leaves the dialog open with what was typed still in
        // it, next to the toast explaining why.
        onSuccess: () => {
          setAddOpen(false);
        },
      });
    },
    [addEntry],
  );

  const confirmRemoval = useCallback(() => {
    if (pendingRemoval === null) {
      return;
    }

    removeEntry.mutate(
      { entryId: pendingRemoval.id, ticker: pendingRemoval.ticker },
      {
        onSuccess: () => {
          setPendingRemoval(null);
        },
      },
    );
  }, [removeEntry, pendingRemoval]);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold tracking-tight text-content-primary">
            Watchlist
          </h2>
          <p className="mt-1 text-sm text-content-secondary">Symbols you follow outside any portfolio, priced live.</p>
        </div>

        <Button
          size="sm"
          icon={<Plus className="size-4" />}
          onClick={() => {
            setAddOpen(true);
          }}
        >
          Add watch
        </Button>
      </header>

      <div className="rounded-card border border-border-subtle bg-surface-sunken">
        {watchlist.isPending ? (
          <WatchlistSkeleton />
        ) : watchlist.isError ? (
          <ErrorState
            error={watchlist.error}
            title="Could not load your watchlist"
            retrying={watchlist.isFetching}
            onRetry={() => {
              void watchlist.refetch();
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<EyeOff className="size-7" />}
            title="Nothing to watch"
            description="Add a symbol to follow its price here without adding it to a portfolio."
          />
        ) : (
          <WatchlistScroller label="Watched symbols">
            {items.map((item) => (
              <WatchlistCard
                key={item.id}
                item={item}
                onRemove={setPendingRemoval}
                removing={removeEntry.isPending && removeEntry.variables.entryId === item.id}
              />
            ))}
          </WatchlistScroller>
        )}
      </div>

      {/* Mounted only while open, so the field starts empty every time without a reset effect. */}
      {addOpen && (
        <AddWatchDialog
          submitting={addEntry.isPending}
          onClose={() => {
            setAddOpen(false);
          }}
          onSubmit={add}
        />
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Stop watching this symbol?"
        confirmLabel="Stop watching"
        loading={removeEntry.isPending}
        onConfirm={confirmRemoval}
        onCancel={() => {
          setPendingRemoval(null);
        }}
      >
        <p className="text-sm text-content-secondary">
          <span className="font-semibold text-content-primary">{pendingRemoval?.ticker}</span> will be removed from your
          watchlist and will stop updating. Your portfolios are not affected.
        </p>
      </ConfirmDialog>
    </section>
  );
}
