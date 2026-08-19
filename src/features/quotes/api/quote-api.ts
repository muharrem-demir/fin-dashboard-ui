import { request } from '../../../shared/api/http-client';

import { stockQuotesSchema, type StockQuotes } from './quote-schemas';

export interface ListQuotesOptions {
  /**
   * Also ask for each ticker's recent daily closes.
   *
   * Off by default because it is not free: the backend answers quotes from one upstream call but
   * fetches history per ticker, so a caller that only wants prices should not pay for fifty extra
   * round trips.
   */
  readonly includeHistory?: boolean;
  readonly signal?: AbortSignal;
}

/**
 * Quotes for several tickers in one call, optionally with their price history.
 *
 * The batch shape is the point: the backend turns one request into one upstream call, so the detail
 * page fetches every holding's price together rather than issuing a request per row. History rides
 * along on the same request for the same reason — the alternative is a second call that re-fetches
 * every quote just to get the closes beside them.
 */
export function listQuotes(
  tickers: readonly string[],
  { includeHistory = false, signal }: ListQuotesOptions = {},
): Promise<StockQuotes> {
  return request({
    path: '/stocks/quotes',
    query: { tickers, ...(includeHistory ? { history: true } : {}) },
    schema: stockQuotesSchema,
    signal,
  });
}
