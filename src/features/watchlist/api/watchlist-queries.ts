import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { isApiError, toUserMessage } from '../../../shared/api/api-error';
import { queryKeys } from '../../../shared/api/query-keys';
import { useToast } from '../../../shared/ui/toast/useToast';

import { addWatchlistEntry, listWatchlist, removeWatchlistEntry } from './watchlist-api';
import type { WatchlistEntry } from './watchlist-schemas';

/**
 * React Query bindings for the watchlist endpoints.
 *
 * Same contract as the portfolio mutations: each one owns the request, the cache invalidation and
 * the toast, so no screen can raise two of the three and forget the last.
 *
 * Nothing here polls. The list changes only when this browser changes it, and the prices on top of it
 * come from the quote feed rather than from a refetch.
 */

export function useWatchlist(): UseQueryResult<readonly WatchlistEntry[]> {
  return useQuery({
    queryKey: queryKeys.watchlist.list(),
    queryFn: ({ signal }) => listWatchlist(signal),
  });
}

export function useAddWatchlistEntry(): UseMutationResult<WatchlistEntry, Error, string> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (ticker: string) => addWatchlistEntry(ticker),
    onSuccess: async (entry) => {
      // Invalidating the list rather than appending the response to it: the backend decides the
      // order, and a locally appended entry would sit in a different place after the next load.
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all });
      toast.success(`Watching ${entry.ticker}`, { description: 'Its price will update live.' });
    },
    onError: (error, ticker) => {
      // 409 is the one failure that is not really a failure: the symbol is on the list, which is what
      // the user wanted. Saying so beats a generic "could not add".
      const description =
        isApiError(error) && error.status === 409
          ? `${ticker.trim().toUpperCase()} is already on your watchlist.`
          : toUserMessage(error);

      toast.error('Could not add the symbol', { description });
    },
  });
}

export interface RemoveWatchlistEntryInput {
  readonly entryId: string;
  /** Only for the toast; the endpoint needs just the id. */
  readonly ticker: string;
}

export function useRemoveWatchlistEntry(): UseMutationResult<void, Error, RemoveWatchlistEntryInput> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ entryId }: RemoveWatchlistEntryInput) => removeWatchlistEntry(entryId),
    onSuccess: async (_result, { ticker }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist.all });
      toast.success(`Stopped watching ${ticker}`, { description: 'It is no longer on your watchlist.' });
    },
    onError: (error, { ticker }) => {
      // A 404 means the entry went between the confirmation and the request — another tab, most
      // likely — which is worth saying precisely rather than as a generic failure.
      const description =
        isApiError(error) && error.isNotFound ? `${ticker} is no longer on your watchlist.` : toUserMessage(error);

      toast.error('Could not remove the symbol', { description });
    },
  });
}
