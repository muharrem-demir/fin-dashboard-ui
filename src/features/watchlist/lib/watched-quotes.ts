import type { QuoteTickMessage } from '../../quotes/ws/stream-messages';
import type { WatchlistEntry } from '../api/watchlist-schemas';

/**
 * The rules for turning a list of watched symbols plus a stream of quotes into cards on screen.
 *
 * Pure and free of React, for the same reason `portfolio-detail/lib/holdings.ts` is: this is where a
 * price gets attached to a symbol, and a mistake here shows up as a card quietly wearing the wrong
 * number rather than as an error. Tested as a table of inputs instead of through a rendered card.
 *
 * Deliberately *not* the holdings merge with the shares removed. A watchlist entry has no position,
 * so there is no total value to compute and nothing to get wrong about it; and the two features would
 * otherwise be coupled through a module neither owns. The overlap is a few lines, and they are the few
 * lines that are easiest to keep correct.
 *
 * There is only one price layer here, not two. The detail page opens with a REST batch because a table
 * of em dashes waiting for the first tick looks broken; a handful of small cards has the room to say
 * "awaiting price" honestly for one interval, and asking a capped batch endpoint for symbols the feed
 * is about to push anyway would be a second source of the same numbers.
 */

/** Whether a price has arrived for a watched symbol yet, and if not, why. */
export type WatchStatus =
  /** No tick yet: the feed is still connecting, or the symbol was only just added. */
  | 'pending'
  /** A price is known. */
  | 'live'
  /** The provider explicitly reported no data for this symbol. */
  | 'unavailable';

/** One symbol's most recent live price. */
export interface WatchedQuote {
  readonly price: number;
  readonly percentChange?: number;
  readonly receivedAt: number;
}

export interface WatchlistQuoteState {
  readonly byTicker: Readonly<Record<string, WatchedQuote>>;
  /** Symbols the feed reported no data for on its most recent tick. */
  readonly unresolved: readonly string[];
  readonly lastTickAt: number | null;
}

export const emptyWatchlistQuoteState: WatchlistQuoteState = {
  byTicker: {},
  unresolved: [],
  lastTickAt: null,
};

/** The API normalises symbols to upper case; the client matches that so lookups never miss. */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * The symbols to subscribe to, normalised, de-duplicated and sorted.
 *
 * Sorted because the value is compared by contents rather than by identity further up: an unsorted
 * list would re-send the whole subscription every time the backend returned the same entries in a
 * different order.
 */
export function watchedTickers(entries: readonly WatchlistEntry[]): readonly string[] {
  return [...new Set(entries.map((entry) => normalizeTicker(entry.ticker)))].sort();
}

/**
 * Folds one WebSocket tick into the live layer.
 *
 * Merges rather than replaces, so a tick that omits a symbol leaves its last known price standing and
 * a provider hiccup does not blank a card that was populated a moment ago.
 */
export function applyWatchlistTick(
  state: WatchlistQuoteState,
  tick: Pick<QuoteTickMessage, 'quotes' | 'unresolved'>,
  receivedAt: number = Date.now(),
): WatchlistQuoteState {
  const byTicker: Record<string, WatchedQuote> = { ...state.byTicker };

  for (const quote of tick.quotes) {
    byTicker[normalizeTicker(quote.ticker)] = {
      price: quote.price,
      percentChange: quote.percentChange,
      receivedAt,
    };
  }

  const priced = new Set(tick.quotes.map((quote) => normalizeTicker(quote.ticker)));

  return {
    byTicker,
    // A symbol that resolved on this tick stops being listed as unresolved; one reported unresolved
    // now is added.
    unresolved: [
      ...new Set([
        ...state.unresolved.filter((ticker) => !priced.has(ticker)),
        ...tick.unresolved.map(normalizeTicker),
      ]),
    ],
    lastTickAt: receivedAt,
  };
}

/** One card, with everything it needs already decided. */
export interface WatchedItem {
  readonly id: string;
  readonly ticker: string;
  readonly price?: number;
  readonly percentChange?: number;
  readonly status: WatchStatus;
  readonly updatedAt?: number;
}

/**
 * Joins watchlist entries to the prices the feed has pushed.
 *
 * Driven by the entries rather than by the quotes, so a price left over for a symbol that has since
 * been removed cannot resurrect a card — and a symbol removed and re-added shows as `pending` rather
 * than wearing its old price, because the live layer is only ever read through the current entries.
 */
export function buildWatchedItems(
  entries: readonly WatchlistEntry[],
  live: WatchlistQuoteState = emptyWatchlistQuoteState,
): readonly WatchedItem[] {
  const unresolved = new Set(live.unresolved.map(normalizeTicker));

  return entries.map((entry) => {
    const ticker = normalizeTicker(entry.ticker);
    const quote = live.byTicker[ticker];

    return {
      id: entry.id,
      ticker,
      price: quote?.price,
      percentChange: quote?.percentChange,
      status: quote !== undefined ? 'live' : unresolved.has(ticker) ? 'unavailable' : 'pending',
      updatedAt: quote?.receivedAt,
    };
  });
}
