import { memo } from 'react';

import { formatCurrency } from '../../../shared/lib/format';
import { ChangeBadge } from '../../../shared/ui/ChangeBadge';
import { X } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import type { WatchedItem } from '../lib/watched-quotes';

export interface WatchlistCardProps {
  readonly item: WatchedItem;
  readonly onRemove: (item: WatchedItem) => void;
  readonly removing: boolean;
}

/**
 * One watched symbol, as a small tile.
 *
 * Fixed width rather than fluid: the strip scrolls sideways, so a card that grew to fill the row would
 * make a watchlist of two symbols look like a table and one of twenty look like a rope. A fixed card
 * also means the ticker and the price never reflow as prices tick.
 *
 * `memo` is load-bearing rather than a precaution — the feed re-renders the section every three
 * seconds with a fresh items array, and only the cards whose numbers actually moved should re-render.
 */
export const WatchlistCard = memo(function WatchlistCard({
  item,
  onRemove,
  removing,
}: WatchlistCardProps): React.JSX.Element {
  const price =
    item.status === 'unavailable' ? (
      <span className="text-xs text-content-muted italic">no data</span>
    ) : item.price === undefined ? (
      // A pulsing placeholder, not an em dash: the price is coming, it just has not arrived yet.
      <span aria-label="Awaiting price" className="inline-block h-4 w-14 animate-pulse rounded bg-surface-sunken" />
    ) : (
      <span className="numeric text-sm text-content-secondary">{formatCurrency(item.price)}</span>
    );

  return (
    <li
      // Named so the tile is one navigable group rather than three loose values, and so its ticker is
      // announced before the numbers that belong to it.
      aria-label={item.ticker}
      className="flex w-40 shrink-0 flex-col justify-between gap-6 rounded-card border border-border-subtle bg-surface-raised p-3 shadow-card"
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xl leading-none font-bold tracking-tight text-content-primary">{item.ticker}</span>

        <IconButton
          label={`Stop watching ${item.ticker}`}
          icon={<X className="size-3.5" />}
          variant="danger-ghost"
          loading={removing}
          className="-mt-1.5 -mr-1.5 size-7"
          onClick={() => {
            onRemove(item);
          }}
        />
      </div>

      <div className="flex items-end justify-between gap-2">
        {price}
        <ChangeBadge percentChange={item.percentChange} size="sm" className="-mr-1" />
      </div>
    </li>
  );
});
