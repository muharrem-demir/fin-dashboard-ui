/**
 * Every React Query cache key in the app, in one place.
 *
 * Centralised because invalidation is the part that breaks quietly: a mutation that invalidates
 * `['portfolio', id]` while the query registered `['portfolios', id]` produces no error at all, just
 * a screen that stops updating. With the keys defined once, a typo is a compile error.
 *
 * `as const` throughout so the tuples are readonly and literal — that is what lets a prefix like
 * `queryKeys.portfolios.all` invalidate every portfolio query underneath it.
 */
export const queryKeys = {
  portfolios: {
    all: ['portfolios'] as const,
    list: () => ['portfolios', 'list'] as const,
    detail: (portfolioId: string) => ['portfolios', 'detail', portfolioId] as const,
  },
  quotes: {
    all: ['quotes'] as const,
    /**
     * Keyed by the sorted ticker list, so two portfolios holding the same symbols share one cache
     * entry and reordering a portfolio does not force a refetch.
     */
    batch: (tickers: readonly string[]) => ['quotes', 'batch', [...tickers].sort()] as const,
  },
} as const;
