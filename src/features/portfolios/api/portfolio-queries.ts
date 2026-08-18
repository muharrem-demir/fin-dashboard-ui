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

import {
  addStock,
  createPortfolio,
  deletePortfolio,
  getPortfolio,
  listPortfolios,
  removeStock,
  renamePortfolio,
} from './portfolio-api';
import type { Portfolio, PortfolioSummary } from './portfolio-schemas';

/**
 * React Query bindings for the portfolio endpoints.
 *
 * Each mutation owns three things: the request, the cache invalidation, and the toast. Keeping them
 * together is what guarantees the requirement that *every* successful write and *every* failure is
 * announced — there is no path through a mutation that forgets, and no screen has to remember to add
 * one.
 *
 * Writes that return the updated portfolio also seed the detail cache with the response
 * (`setQueryData`) before invalidating the list. That is what makes adding a holding feel immediate:
 * the table re-renders from the response rather than after a second round trip.
 */

export function usePortfolios(): UseQueryResult<readonly PortfolioSummary[]> {
  return useQuery({
    queryKey: queryKeys.portfolios.list(),
    queryFn: ({ signal }) => listPortfolios(signal),
  });
}

export function usePortfolio(portfolioId: string): UseQueryResult<Portfolio> {
  return useQuery({
    queryKey: queryKeys.portfolios.detail(portfolioId),
    queryFn: ({ signal }) => getPortfolio(portfolioId, signal),
    // A portfolio that does not exist will not start existing on retry, and retrying only delays the
    // "not found" screen the user needs to see.
    retry: (failureCount, error) => (isApiError(error) && !error.isRetryable ? false : failureCount < 2),
  });
}

export function useCreatePortfolio(): UseMutationResult<Portfolio, Error, string> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (name: string) => createPortfolio(name),
    onSuccess: async (portfolio) => {
      queryClient.setQueryData(queryKeys.portfolios.detail(portfolio.id), portfolio);
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.all });
      toast.success('Portfolio created', { description: `“${portfolio.name}” is ready.` });
    },
    onError: (error) => {
      toast.error('Could not create the portfolio', { description: toUserMessage(error) });
    },
  });
}

export function useRenamePortfolio(portfolioId: string): UseMutationResult<Portfolio, Error, string> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (name: string) => renamePortfolio(portfolioId, name),
    onSuccess: async (portfolio) => {
      // Keyed on the id this hook was created with, not on the one in the response: they are the same
      // portfolio, and using the argument means the cache is updated even if the server ever answered
      // with a differently-shaped identifier.
      queryClient.setQueryData(queryKeys.portfolios.detail(portfolioId), portfolio);
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.list() });
      toast.success('Portfolio renamed', { description: `Now called “${portfolio.name}”.` });
    },
    onError: (error) => {
      toast.error('Could not rename the portfolio', { description: toUserMessage(error) });
    },
  });
}

export interface DeletePortfolioInput {
  readonly portfolioId: string;
  /** Only for the toast; the endpoint needs just the id. */
  readonly name: string;
}

export function useDeletePortfolio(): UseMutationResult<void, Error, DeletePortfolioInput> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ portfolioId }: DeletePortfolioInput) => deletePortfolio(portfolioId),
    onSuccess: async (_result, { portfolioId, name }) => {
      // Drop the detail entry outright rather than invalidating it: refetching a portfolio that was
      // just deleted would only produce a 404 and an error toast for something that worked.
      queryClient.removeQueries({ queryKey: queryKeys.portfolios.detail(portfolioId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.list() });
      toast.success('Portfolio deleted', { description: `“${name}” and its holdings are gone.` });
    },
    onError: (error) => {
      toast.error('Could not delete the portfolio', { description: toUserMessage(error) });
    },
  });
}

export interface AddStockInput {
  readonly ticker: string;
  readonly shares: number;
}

export function useAddStock(portfolioId: string): UseMutationResult<Portfolio, Error, AddStockInput> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ ticker, shares }: AddStockInput) => addStock(portfolioId, ticker, shares),
    onSuccess: async (portfolio, { ticker, shares }) => {
      // Seeding the detail cache from the response is what makes a new holding appear at once, and it
      // is also what re-derives the ticker list the live feed subscribes to.
      queryClient.setQueryData(queryKeys.portfolios.detail(portfolioId), portfolio);
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.list() });

      const normalized = ticker.trim().toUpperCase();
      const position = portfolio.stocks.find((stock) => stock.ticker === normalized);

      // Adding to an existing position accumulates rather than replaces, so the toast reports the
      // resulting total — otherwise "Added 5 shares" reads as though the position is now 5.
      toast.success(`Added ${String(shares)} ${shares === 1 ? 'share' : 'shares'} of ${normalized}`, {
        description:
          position === undefined
            ? undefined
            : `${normalized} position is now ${String(position.shares)} ${position.shares === 1 ? 'share' : 'shares'}.`,
      });
    },
    onError: (error) => {
      toast.error('Could not add the stock', { description: toUserMessage(error) });
    },
  });
}

export function useRemoveStock(portfolioId: string): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (ticker: string) => removeStock(portfolioId, ticker),
    onSuccess: async (_result, ticker) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.all });
      toast.success(`Removed ${ticker.trim().toUpperCase()}`, {
        description: 'The position is no longer part of this portfolio.',
      });
    },
    onError: (error, ticker) => {
      // A 404 here means the holding vanished between the confirmation and the request — another tab,
      // most likely — which is worth saying precisely rather than as a generic failure.
      const description =
        isApiError(error) && error.isNotFound
          ? `${ticker.trim().toUpperCase()} is no longer in this portfolio.`
          : toUserMessage(error);

      toast.error('Could not remove the stock', { description });
    },
  });
}
