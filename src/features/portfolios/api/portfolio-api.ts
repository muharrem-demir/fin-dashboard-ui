import { request } from '../../../shared/api/http-client';

import { portfolioListSchema, portfolioSchema, type Portfolio, type PortfolioSummary } from './portfolio-schemas';

/**
 * One function per endpoint, and nothing else.
 *
 * Deliberately free of React: these are plain async functions, which is what lets the mutation and
 * query hooks in `portfolio-queries.ts` stay thin and lets the endpoints be tested against a stubbed
 * `fetch` with no renderer involved.
 */

export function listPortfolios(signal?: AbortSignal): Promise<readonly PortfolioSummary[]> {
  return request({
    path: '/portfolios',
    schema: portfolioListSchema,
    signal,
  });
}

export function getPortfolio(portfolioId: string, signal?: AbortSignal): Promise<Portfolio> {
  return request({
    path: `/portfolios/${encodeURIComponent(portfolioId)}`,
    schema: portfolioSchema,
    signal,
  });
}

export function createPortfolio(name: string): Promise<Portfolio> {
  return request({
    method: 'POST',
    path: '/portfolios',
    body: { name },
    schema: portfolioSchema,
  });
}

export function renamePortfolio(portfolioId: string, name: string): Promise<Portfolio> {
  return request({
    method: 'PATCH',
    path: `/portfolios/${encodeURIComponent(portfolioId)}`,
    body: { name },
    schema: portfolioSchema,
  });
}

export function deletePortfolio(portfolioId: string): Promise<void> {
  return request({
    method: 'DELETE',
    path: `/portfolios/${encodeURIComponent(portfolioId)}`,
  });
}

/**
 * Adds shares to a portfolio.
 *
 * Adding a ticker the portfolio already holds *increases* the position rather than replacing it, and
 * the response is the whole updated portfolio — which is why callers seed the detail cache from the
 * result instead of refetching.
 */
export function addStock(portfolioId: string, ticker: string, shares: number): Promise<Portfolio> {
  return request({
    method: 'POST',
    path: `/portfolios/${encodeURIComponent(portfolioId)}/stocks`,
    body: { ticker, shares },
    schema: portfolioSchema,
  });
}

/** Answers 404 when the portfolio does not hold the ticker at all. */
export function removeStock(portfolioId: string, ticker: string): Promise<void> {
  return request({
    method: 'DELETE',
    path: `/portfolios/${encodeURIComponent(portfolioId)}/stocks/${encodeURIComponent(ticker)}`,
  });
}
