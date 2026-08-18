import { memo, useEffect, useRef, type RefObject } from 'react';

import { NOT_AVAILABLE, formatCurrency, formatShares } from '../../../shared/lib/format';
import { Trash2 } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import type { Holding } from '../lib/holdings';

import { ChangeBadge } from './ChangeBadge';

export interface HoldingsTableProps {
  readonly holdings: readonly Holding[];
  readonly onRemove: (ticker: string) => void;
  readonly removingTicker?: string | null;
}

/**
 * How long a row stays tinted after its price moves.
 *
 * Long enough to catch the eye on a three-second feed, short enough that the tint is gone before the
 * next tick — otherwise an active symbol would sit permanently coloured and the signal would stop
 * meaning anything.
 */
const FLASH_MS = 900;

/**
 * Tints a row green or red for a moment when its price changes.
 *
 * Implemented by adding a class to the row element rather than by holding the flash in state. The class is
 * the external system this effect exists to synchronise, and doing it this way means a tick that moves one
 * symbol re-renders nothing at all — on a three-second feed across a few dozen rows, that is the difference
 * between a table that stays responsive and one that does not.
 *
 * Keyed on `updatedAt` rather than on the price, so a tick re-confirming the same price does not flash while
 * two consecutive moves in the same direction each do.
 */
function usePriceFlash(row: RefObject<HTMLTableRowElement | null>, holding: Holding): void {
  const lastSeen = useRef<number | undefined>(undefined);

  useEffect(() => {
    const element = row.current;

    if (element === null || holding.updatedAt === undefined || holding.updatedAt === lastSeen.current) {
      return;
    }

    lastSeen.current = holding.updatedAt;

    if (holding.move === null) {
      return;
    }

    const className = holding.move === 'up' ? 'animate-flash-gain' : 'animate-flash-loss';
    element.classList.add(className);

    const timer = setTimeout(() => {
      element.classList.remove(className);
    }, FLASH_MS);

    return () => {
      clearTimeout(timer);
      element.classList.remove(className);
    };
  }, [row, holding.updatedAt, holding.move]);
}

interface HoldingRowProps {
  readonly holding: Holding;
  readonly onRemove: (ticker: string) => void;
  readonly removing: boolean;
}

/**
 * `memo` is load-bearing here rather than a precaution: on every tick the parent re-renders with a
 * fresh holdings array, and without this each row's flash effect would re-run for symbols whose price
 * did not move.
 */
const HoldingRow = memo(function HoldingRow({ holding, onRemove, removing }: HoldingRowProps): React.JSX.Element {
  const row = useRef<HTMLTableRowElement>(null);
  usePriceFlash(row, holding);

  const priceCell =
    holding.quoteStatus === 'unavailable' ? (
      <span className="text-xs text-content-muted italic">no data</span>
    ) : holding.price === undefined ? (
      // A pulsing placeholder, not an em dash: the price is coming, it just has not arrived yet.
      <span aria-label="Awaiting price" className="inline-block h-4 w-16 animate-pulse rounded bg-surface-sunken" />
    ) : (
      formatCurrency(holding.price)
    );

  return (
    <tr ref={row} className="transition-colors hover:bg-surface-hover">
      <th scope="row" className="px-4 py-3.5 text-left align-middle sm:px-5">
        <span className="font-semibold tracking-tight text-content-primary">{holding.ticker}</span>
      </th>

      <td className="numeric px-4 py-3.5 text-right align-middle text-content-secondary sm:px-5">
        {formatShares(holding.shares)}
      </td>

      <td className="numeric px-4 py-3.5 text-right align-middle text-content-primary sm:px-5">{priceCell}</td>

      <td className="px-4 py-3.5 text-right align-middle sm:px-5">
        <ChangeBadge percentChange={holding.percentChange} size="sm" />
      </td>

      <td className="numeric px-4 py-3.5 text-right align-middle font-semibold text-content-primary sm:px-5">
        {holding.totalValue === undefined ? NOT_AVAILABLE : formatCurrency(holding.totalValue)}
      </td>

      <td className="px-2 py-3.5 text-right align-middle sm:px-3">
        <IconButton
          label={`Remove ${holding.ticker}`}
          icon={<Trash2 className="size-4" />}
          variant="danger-ghost"
          loading={removing}
          onClick={() => {
            onRemove(holding.ticker);
          }}
        />
      </td>
    </tr>
  );
});

/**
 * The holdings table.
 *
 * A real `<table>` rather than a grid of divs: this is tabular data, and the row/column semantics are
 * what let a screen reader announce "AAPL, total value, $2,253.75" instead of reading five unrelated
 * numbers. On narrow screens the whole table scrolls horizontally inside its own container, which
 * keeps every column readable rather than crushing the price into two characters.
 */
export function HoldingsTable({ holdings, onRemove, removingTicker }: HoldingsTableProps): React.JSX.Element {
  return (
    <div className="scrollbar-slim overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">
          Holdings in this portfolio, with live prices, percent change and total value
        </caption>

        <thead>
          <tr className="border-b border-border-subtle bg-surface-sunken/60">
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-content-muted uppercase sm:px-5"
            >
              Ticker
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-content-muted uppercase sm:px-5"
            >
              Shares
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-content-muted uppercase sm:px-5"
            >
              Price
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-content-muted uppercase sm:px-5"
            >
              Change
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-content-muted uppercase sm:px-5"
            >
              Total value
            </th>
            <th scope="col" className="px-2 py-2.5 sm:px-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border-subtle">
          {holdings.map((holding) => (
            <HoldingRow
              key={holding.ticker}
              holding={holding}
              onRemove={onRemove}
              removing={removingTicker === holding.ticker}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
