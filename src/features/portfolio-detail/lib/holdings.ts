import type { StockQuote, StockQuotes } from '../../quotes/api/quote-schemas';
import type { LiveQuote, QuoteTickMessage } from '../../quotes/ws/stream-messages';
import type { Stock } from '../../portfolios/api/portfolio-schemas';

/**
 * The rules for turning a list of holdings plus a stream of quotes into rows on screen.
 *
 * Pure and free of React on purpose. Merging live prices into positions is the one place in this app where
 * a subtle mistake is both easy to make and hard to see — a stale price against fresh shares silently
 * produces a wrong total value — so the logic lives here, where it is tested with plain data rather than
 * through a rendered table.
 *
 * Prices arrive from two places and are kept in two layers rather than folded into one store:
 *
 *   - the **batch** layer is React Query's cached response to `GET /stocks/quotes`, owned by the query
 *     cache and never copied into component state;
 *   - the **live** layer holds what the WebSocket has pushed since, and is the only piece of local state.
 *
 * Keeping them separate is what lets the merge be a pure render-time derivation. Copying the batch into
 * local state would mean the same prices lived in two places, and every bug in that class of design is the
 * two copies disagreeing.
 */

/** Whether a price has arrived for a position yet, and if not, why. */
export type QuoteStatus =
  /** No quote yet: the batch request is still in flight, or a newly added ticker has not ticked. */
  | 'pending'
  /** A price is known. */
  | 'live'
  /** The provider explicitly reported no data for this symbol. */
  | 'unavailable';

/** Which way the last price move went, so a row can flash green or red. */
export type PriceMove = 'up' | 'down' | null;

/** One symbol's most recent live price, plus the price it replaced. */
export interface LiveSnapshot {
  readonly price: number;
  readonly previousClose?: number;
  readonly percentChange?: number;
  /**
   * Shares, when a live frame carries them.
   *
   * The current backend does not push position changes, but the requirement is that shares may move in
   * real time, and honouring the field costs nothing: when it is absent the REST value stands.
   */
  readonly shares?: number;
  /**
   * The price this snapshot superseded, or undefined for the first tick of a symbol.
   *
   * Stored rather than derived because the comparison basis is only known at the moment the tick arrives —
   * by render time the old value is gone.
   */
  readonly supersededPrice?: number;
  readonly receivedAt: number;
}

export interface LiveQuoteState {
  readonly byTicker: Readonly<Record<string, LiveSnapshot>>;
  /** Symbols the feed reported no data for on its most recent tick. */
  readonly unresolved: readonly string[];
  readonly lastTickAt: number | null;
}

export const emptyLiveQuoteState: LiveQuoteState = {
  byTicker: {},
  unresolved: [],
  lastTickAt: null,
};

/** One row of the holdings table, with everything it needs already computed. */
export interface Holding {
  readonly ticker: string;
  readonly shares: number;
  readonly price?: number;
  readonly previousClose?: number;
  readonly percentChange?: number;
  /** `shares × price`, or undefined while no price is known — never a misleading zero. */
  readonly totalValue?: number;
  readonly quoteStatus: QuoteStatus;
  readonly move: PriceMove;
  readonly updatedAt?: number;
}

/** The API normalises symbols to upper case; the client matches that so lookups never miss. */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/** Indexes a batch response by normalised ticker. */
function indexBatch(batch: StockQuotes | undefined): Readonly<Record<string, StockQuote>> {
  if (batch === undefined) {
    return {};
  }

  const byTicker: Record<string, StockQuote> = {};

  for (const quote of batch.quotes) {
    byTicker[normalizeTicker(quote.ticker)] = quote;
  }

  return byTicker;
}

function moveFor(live: LiveSnapshot | undefined, basis: number | undefined): PriceMove {
  if (live === undefined || basis === undefined || live.price === basis) {
    return null;
  }

  return live.price > basis ? 'up' : 'down';
}

export interface BuildHoldingsInput {
  readonly stocks: readonly Stock[];
  /** React Query's cached batch response, or undefined while it is still loading or has failed. */
  readonly batch?: StockQuotes;
  readonly live?: LiveQuoteState;
}

/**
 * Joins positions to quotes.
 *
 * Driven by the position list rather than by the quotes: the portfolio decides which rows exist, so a
 * price left over for a ticker that has since been removed cannot resurrect a row — and a symbol removed
 * and re-added shows as `pending` rather than wearing its old price, because the live layer is only ever
 * read through the current holdings.
 *
 * The live layer wins over the batch for any symbol it has, since a tick is by definition newer.
 */
export function buildHoldings({ stocks, batch, live = emptyLiveQuoteState }: BuildHoldingsInput): readonly Holding[] {
  const batchByTicker = indexBatch(batch);
  const batchUnresolved = new Set((batch?.unresolved ?? []).map(normalizeTicker));
  const liveUnresolved = new Set(live.unresolved.map(normalizeTicker));

  return stocks.map((stock) => {
    const ticker = normalizeTicker(stock.ticker);
    const liveQuote = live.byTicker[ticker];
    const batchQuote = batchByTicker[ticker];
    const source = liveQuote ?? batchQuote;

    const shares = liveQuote?.shares ?? stock.shares;
    const price = source?.price;

    // The first tick for a symbol is compared against the opening batch price, so a move that happens
    // before the second tick still flashes.
    const move = moveFor(liveQuote, liveQuote?.supersededPrice ?? batchQuote?.price);

    const quoteStatus: QuoteStatus =
      price !== undefined
        ? 'live'
        : liveUnresolved.has(ticker) || batchUnresolved.has(ticker)
          ? 'unavailable'
          : 'pending';

    return {
      ticker,
      shares,
      price,
      previousClose: source?.previousClose,
      percentChange: source?.percentChange,
      totalValue: price === undefined ? undefined : shares * price,
      quoteStatus,
      move,
      updatedAt: liveQuote?.receivedAt,
    };
  });
}

/**
 * The portfolio's market value.
 *
 * Positions without a price contribute nothing rather than blocking the sum, and `pricedCount` reports how
 * many did contribute so the UI can mark the figure as partial instead of presenting an incomplete total
 * as authoritative.
 */
export function portfolioValue(holdings: readonly Holding[]): {
  readonly total: number;
  readonly pricedCount: number;
  readonly complete: boolean;
} {
  let total = 0;
  let pricedCount = 0;

  for (const holding of holdings) {
    if (holding.totalValue !== undefined) {
      total += holding.totalValue;
      pricedCount += 1;
    }
  }

  return { total, pricedCount, complete: pricedCount === holdings.length };
}

/** The value-weighted percent change across every priced position. */
export function weightedPercentChange(holdings: readonly Holding[]): number | undefined {
  let weighted = 0;
  let basis = 0;

  for (const holding of holdings) {
    if (holding.totalValue === undefined || holding.percentChange === undefined) {
      continue;
    }

    weighted += holding.totalValue * holding.percentChange;
    basis += holding.totalValue;
  }

  return basis === 0 ? undefined : weighted / basis;
}

/**
 * Folds one WebSocket tick into the live layer.
 *
 * Merges rather than replaces: a tick that omits a symbol leaves that symbol's last known price standing,
 * and a provider hiccup that reports a symbol as unresolved does not blank a column that was populated a
 * moment ago.
 */
export function applyQuoteTick(
  state: LiveQuoteState,
  tick: Pick<QuoteTickMessage, 'quotes' | 'unresolved'>,
  receivedAt: number = Date.now(),
): LiveQuoteState {
  const byTicker: Record<string, LiveSnapshot> = { ...state.byTicker };

  for (const quote of tick.quotes as readonly LiveQuote[]) {
    const ticker = normalizeTicker(quote.ticker);
    const previous = byTicker[ticker];

    byTicker[ticker] = {
      price: quote.price,
      previousClose: quote.previousClose,
      percentChange: quote.percentChange,
      shares: quote.shares ?? previous?.shares,
      supersededPrice: previous?.price,
      receivedAt,
    };
  }

  const priced = new Set(tick.quotes.map((quote) => normalizeTicker(quote.ticker)));

  return {
    byTicker,
    // A symbol that resolved on this tick stops being listed as unresolved; one reported unresolved now
    // is added.
    unresolved: [
      ...new Set([
        ...state.unresolved.filter((ticker) => !priced.has(ticker)),
        ...tick.unresolved.map(normalizeTicker),
      ]),
    ],
    lastTickAt: receivedAt,
  };
}
