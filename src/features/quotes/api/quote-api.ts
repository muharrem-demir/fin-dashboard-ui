import { request } from '../../../shared/api/http-client';

import { stockQuotesSchema, type StockQuotes } from './quote-schemas';

/**
 * Quotes for several tickers in one call.
 *
 * The batch shape is the point: the backend turns one request into one upstream call, so the detail
 * page fetches every holding's price together rather than issuing a request per row.
 */
export function listQuotes(tickers: readonly string[], signal?: AbortSignal): Promise<StockQuotes> {
  return request({
    path: '/stocks/quotes',
    query: { tickers },
    schema: stockQuotesSchema,
    signal,
  });
}
