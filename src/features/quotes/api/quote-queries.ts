import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { isApiError } from '../../../shared/api/api-error';
import { queryKeys } from '../../../shared/api/query-keys';

import { listQuotes } from './quote-api';
import type { StockQuotes } from './quote-schemas';

/**
 * The opening batch of prices for a portfolio's holdings.
 *
 * Fires as soon as the portfolio's stock list arrives and only when that list is non-empty — the
 * `enabled` flag is doing the work of "if there are any stocks in the response, immediately fetch
 * quotes", and it also keeps the app from asking the API for the quotes of nothing.
 *
 * After this one call the WebSocket takes over, so there is no refetch interval: polling would
 * duplicate the feed and double the load on the upstream provider.
 */
export function useQuotesBatch(tickers: readonly string[]): UseQueryResult<StockQuotes> {
  return useQuery({
    queryKey: queryKeys.quotes.batch(tickers),
    queryFn: ({ signal }) => listQuotes(tickers, signal),
    enabled: tickers.length > 0,
    // Prices go stale by nature, but the stream is the thing that refreshes them; re-running this on
    // every window focus would fight the feed rather than help it.
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    // A 502 means the upstream provider is refusing calls, and the README is explicit that this can
    // be the normal state of affairs against live Yahoo. One retry, then let the stream try instead
    // of hammering a dependency that is already unhappy.
    retry: (failureCount, error) =>
      isApiError(error) && error.isUpstreamUnavailable ? failureCount < 1 : failureCount < 2,
  });
}
