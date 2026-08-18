import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '../../shared/api/api-error';

/**
 * Cache defaults for the whole app.
 *
 * Two decisions carry most of the weight. Retries never fire for a 4xx, because re-requesting a portfolio
 * that does not exist is three guaranteed failures and a three-times-slower error screen. And `staleTime`
 * is 30 seconds rather than zero: portfolio *composition* changes only when the user changes it, while
 * *prices* arrive over the WebSocket, so aggressive refetching would add load without making anything on
 * screen fresher.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (isApiError(error) && !error.isRetryable) {
            return false;
          }

          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: true,
      },
      mutations: {
        // A failed write is reported by its own `onError` toast; retrying a POST silently risks creating
        // two portfolios from one click.
        retry: false,
      },
    },
  });
}
