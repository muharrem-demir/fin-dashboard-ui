import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { cn } from '../../../shared/lib/cn';
import { NOT_AVAILABLE, formatCurrency, formatShares } from '../../../shared/lib/format';
import { ChevronDown, ChevronsUpDown, ChevronUp, Trash2 } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import type { Holding } from '../lib/holdings';
import { isChartable } from '../lib/price-history';
import { DEFAULT_SORT, nextSort, sortHoldings, type HoldingSort, type HoldingSortKey } from '../lib/sort-holdings';

import { ChangeBadge } from './ChangeBadge';
import { PriceHistoryDialog } from './PriceHistoryDialog';
import { PriceSparkline } from './PriceSparkline';

export interface HoldingsTableProps {
  readonly holdings: readonly Holding[];
  readonly onRemove: (ticker: string) => void;
  readonly removingTicker?: string | null;
  /** True while the opening batch — which is what carries history — is still in flight. */
  readonly historyPending?: boolean;
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
  readonly onShowHistory: (ticker: string) => void;
  readonly removing: boolean;
  readonly historyPending: boolean;
}

/**
 * `memo` is load-bearing here rather than a precaution: on every tick the parent re-renders with a
 * fresh holdings array, and without this each row's flash effect would re-run for symbols whose price
 * did not move.
 */
const HoldingRow = memo(function HoldingRow({
  holding,
  onRemove,
  onShowHistory,
  removing,
  historyPending,
}: HoldingRowProps): React.JSX.Element {
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

  /*
   * The chart is a button because it does something — it opens the detailed view — and a click target
   * only a mouse can reach would put the whole history behind a pointer.
   *
   * Every branch is exactly `h-5`, the line height of the text in the neighbouring cells, so the history
   * column never changes the height of a row whether it is drawing, waiting or empty.
   */
  const historyCell = isChartable(holding.history) ? (
    <button
      type="button"
      aria-label={`Show ${holding.ticker} price history`}
      onClick={() => {
        onShowHistory(holding.ticker);
      }}
      className={cn(
        // Tailwind v4's preflight gives every button `cursor: default`, so a clickable graphic has to
        // ask for the pointer itself.
        'flex h-5 w-16 cursor-pointer items-center justify-end rounded-sm transition-opacity',
        'hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      )}
    >
      <PriceSparkline points={holding.history.points} />
    </button>
  ) : historyPending ? (
    <span aria-label="Awaiting price history" className="block h-5 w-16 animate-pulse rounded bg-surface-sunken" />
  ) : (
    <span className="numeric flex h-5 items-center text-content-muted">{NOT_AVAILABLE}</span>
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

      <td className="px-4 py-3.5 align-middle sm:px-5">
        {/* A block-level wrapper rather than inline content: an inline box would sit on the row's text
            baseline and grow the line box by its descender space, which is how a 20px graphic silently
            becomes a 24px row. */}
        <div className="flex justify-end">{historyCell}</div>
      </td>

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

type ColumnAlign = 'left' | 'right';

interface SortableColumn {
  readonly kind: 'sortable';
  readonly key: HoldingSortKey;
  readonly label: string;
  readonly align: ColumnAlign;
}

interface PlainColumn {
  readonly kind: 'plain';
  readonly id: string;
  readonly label: string;
  readonly align: ColumnAlign;
}

type TableColumn = SortableColumn | PlainColumn;

/**
 * Every data column, in the order it appears.
 *
 * History is deliberately `plain`. There is no sensible ordering of a line chart — a table sorted by
 * "shape" would be a table in no order at all — so its heading is not a button, which is also what keeps
 * a keyboard user from tabbing onto a control that would do nothing. The actions column is not listed
 * here at all; it has no label.
 */
const COLUMNS: readonly TableColumn[] = [
  { kind: 'sortable', key: 'ticker', label: 'Ticker', align: 'left' },
  { kind: 'sortable', key: 'shares', label: 'Shares', align: 'right' },
  { kind: 'sortable', key: 'price', label: 'Price', align: 'right' },
  { kind: 'plain', id: 'history', label: 'History', align: 'right' },
  { kind: 'sortable', key: 'percentChange', label: 'Change', align: 'right' },
  { kind: 'sortable', key: 'totalValue', label: 'Total value', align: 'right' },
];

const HEADER_CLASS = 'px-4 py-2.5 text-xs font-semibold tracking-wide text-content-muted uppercase sm:px-5';

interface SortableHeaderProps {
  readonly column: SortableColumn;
  readonly sort: HoldingSort;
  readonly onSort: (key: HoldingSortKey) => void;
}

/**
 * One clickable column heading.
 *
 * `aria-sort` on the cell is what carries the state to a screen reader — it is the attribute assistive
 * technology looks for on a sortable table, which means the arrow is decoration rather than the only way
 * to tell which column is active. The arrow also differs in shape between the three states, so direction
 * never depends on colour alone.
 *
 * A real button inside the cell, not a click handler on the header itself: sorting is something a keyboard
 * user has to be able to do, and only a button is focusable and driven by Enter and Space for free.
 */
function SortableHeader({ column, sort, onSort }: SortableHeaderProps): React.JSX.Element {
  const active = sort.key === column.key;
  const ascending = sort.direction === 'asc';

  return (
    <th
      scope="col"
      aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
      className={cn(HEADER_CLASS, column.align === 'right' ? 'text-right' : 'text-left')}
    >
      <button
        type="button"
        onClick={() => {
          onSort(column.key);
        }}
        className={cn(
          // A raw button rather than the shared primitive, so it asks for the pointer itself — Tailwind
          // v4's preflight gives every button `cursor: default` until told otherwise.
          'inline-flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-content-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          // The label stays flush with its column, so the arrow moves to the outside of a right-aligned one.
          column.align === 'right' && 'flex-row-reverse',
          active && 'text-content-primary',
        )}
      >
        {column.label}
        {active ? (
          ascending ? (
            <ChevronUp aria-hidden="true" className="size-3.5 text-brand-600 dark:text-brand-400" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5 text-brand-600 dark:text-brand-400" />
          )
        ) : (
          // Faint until the row of headings is hovered: every sortable column announces itself, but doing
          // that at full strength five times would compete with the data underneath.
          <ChevronsUpDown
            aria-hidden="true"
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60 group-focus-within:opacity-60"
          />
        )}
      </button>
    </th>
  );
}

/**
 * The holdings table.
 *
 * A real `<table>` rather than a grid of divs: this is tabular data, and the row/column semantics are
 * what let a screen reader announce "AAPL, total value, $2,253.75" instead of reading five unrelated
 * numbers. On narrow screens the whole table scrolls horizontally inside its own container, which
 * keeps every column readable rather than crushing the price into two characters.
 *
 * The sort lives here rather than on the page because nothing outside the table depends on it — the
 * subscription, the batch request and the totals above all read the holdings in their own order. Deciding
 * what order rows appear in is what this component is for, so the click that changes it belongs here. The
 * history dialog is here for the same reason: it is opened from a cell and closes back onto that cell, and
 * no other part of the page knows or cares that it is open.
 */
export function HoldingsTable({
  holdings,
  onRemove,
  removingTicker,
  historyPending = false,
}: HoldingsTableProps): React.JSX.Element {
  const [sort, setSort] = useState<HoldingSort>(DEFAULT_SORT);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);

  // Memoised against the tick rate: a table sorted by price re-sorts every time the socket delivers, and
  // there is no reason to redo the comparison for the re-renders that are not about prices.
  const sorted = useMemo(() => sortHoldings(holdings, sort), [holdings, sort]);

  // Read back out of the current rows rather than copied into state when the chart was clicked, so a
  // position removed while its chart is open takes the dialog with it instead of leaving a chart of
  // something the portfolio no longer holds.
  const openHistory = sorted.find((holding) => holding.ticker === historyTicker)?.history;

  return (
    <div className="scrollbar-slim overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">
          Holdings in this portfolio, with live prices, percent change and total value. Ticker, shares, price, change
          and total value each have a heading that sorts by that column; history shows recent closing prices and is not
          sortable.
        </caption>

        <thead>
          <tr className="group border-b border-border-subtle bg-surface-sunken/60">
            {COLUMNS.map((column) =>
              column.kind === 'sortable' ? (
                <SortableHeader
                  key={column.key}
                  column={column}
                  sort={sort}
                  onSort={(key) => {
                    setSort((current) => nextSort(current, key));
                  }}
                />
              ) : (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(HEADER_CLASS, column.align === 'right' ? 'text-right' : 'text-left')}
                >
                  {column.label}
                </th>
              ),
            )}
            <th scope="col" className="px-2 py-2.5 sm:px-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border-subtle">
          {sorted.map((holding) => (
            <HoldingRow
              key={holding.ticker}
              holding={holding}
              onRemove={onRemove}
              onShowHistory={setHistoryTicker}
              removing={removingTicker === holding.ticker}
              historyPending={historyPending}
            />
          ))}
        </tbody>
      </table>

      {openHistory !== undefined && (
        <PriceHistoryDialog
          history={openHistory}
          onClose={() => {
            setHistoryTicker(null);
          }}
        />
      )}
    </div>
  );
}
