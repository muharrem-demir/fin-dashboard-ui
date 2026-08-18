import type { Holding } from './holdings';

/**
 * Ordering the holdings table.
 *
 * Pure, and separate from the price merge for the same reason {@link ./filter-holdings.ts} is: this is a
 * view concern. Sorting decides what order the rows appear in and nothing else — not what is subscribed,
 * not what the portfolio is worth.
 *
 * The one rule worth stating out loud is what happens to a position with no price yet. It sorts last in
 * **both** directions rather than being treated as zero. A missing price is not a cheap stock, and putting
 * the unpriced rows on top the moment the user asks for "most valuable first" would bury the answer under
 * the rows that have no answer.
 */

/** The columns a user can order by. Every one of these is a header in the holdings table. */
export type HoldingSortKey = 'ticker' | 'shares' | 'price' | 'percentChange' | 'totalValue';

export type SortDirection = 'asc' | 'desc';

export interface HoldingSort {
  readonly key: HoldingSortKey;
  readonly direction: SortDirection;
}

/**
 * Which way a column sorts on its first click.
 *
 * Ticker reads as a list, so it opens A→Z. The numeric columns open largest-first, because "sort by total
 * value" almost always means "show me the big positions".
 */
export const DEFAULT_SORT_DIRECTION: Readonly<Record<HoldingSortKey, SortDirection>> = {
  ticker: 'asc',
  shares: 'desc',
  price: 'desc',
  percentChange: 'desc',
  totalValue: 'desc',
};

/**
 * What the table shows before the user touches a header.
 *
 * Alphabetical by ticker rather than the order the API returned: a portfolio is a set, not a sequence, and
 * "where is AMZN" is answered by scanning a sorted column instead of reading every row.
 */
export const DEFAULT_SORT: HoldingSort = { key: 'ticker', direction: 'asc' };

/** The next sort state when a header is clicked: same column flips, a new column starts at its default. */
export function nextSort(current: HoldingSort, key: HoldingSortKey): HoldingSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }

  return { key, direction: DEFAULT_SORT_DIRECTION[key] };
}

/** Numbers ascending or descending, with `undefined` pushed to the bottom either way. */
function compareNumbers(a: number | undefined, b: number | undefined, direction: SortDirection): number {
  if (a === undefined) {
    return b === undefined ? 0 : 1;
  }

  if (b === undefined) {
    return -1;
  }

  return direction === 'asc' ? a - b : b - a;
}

function compareBy(a: Holding, b: Holding, { key, direction }: HoldingSort): number {
  if (key === 'ticker') {
    return direction === 'asc' ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker);
  }

  return compareNumbers(a[key], b[key], direction);
}

/**
 * The holdings in the requested order.
 *
 * Ties break on ticker, ascending. That matters more than it looks: prices arrive every three seconds, so
 * a table sorted by price re-sorts constantly, and without a deterministic tiebreak two rows holding the
 * same value would swap places on every tick.
 */
export function sortHoldings(holdings: readonly Holding[], sort: HoldingSort): readonly Holding[] {
  return [...holdings].sort((a, b) => {
    const result = compareBy(a, b, sort);

    return result !== 0 ? result : a.ticker.localeCompare(b.ticker);
  });
}
