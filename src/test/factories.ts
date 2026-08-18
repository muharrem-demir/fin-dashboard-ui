import type { Portfolio, PortfolioSummary, Stock } from '../features/portfolios/api/portfolio-schemas';
import type { StockQuote, StockQuotes } from '../features/quotes/api/quote-schemas';
import type { QuoteTickMessage } from '../features/quotes/ws/stream-messages';

/**
 * Builders for API payloads.
 *
 * Each takes an overrides object so a test states only the field it is about — `aQuote({ price: 10 })`
 * says "the price is what matters here" far more clearly than a full literal in which the reader has to
 * spot the one interesting number.
 */

export function aStock(overrides: Partial<Stock> = {}): Stock {
  return { ticker: 'AAPL', shares: 10, ...overrides };
}

export function aPortfolioSummary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    id: '3f8c1a2b-0000-4000-8000-000000000001',
    name: 'Growth',
    stockCount: 2,
    totalShares: 35,
    ...overrides,
  };
}

export function aPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  const stocks = overrides.stocks ?? [aStock(), aStock({ ticker: 'MSFT', shares: 25 })];

  return {
    id: '3f8c1a2b-0000-4000-8000-000000000001',
    name: 'Growth',
    stocks,
    stockCount: stocks.length,
    totalShares: stocks.reduce((total, stock) => total + stock.shares, 0),
    ...overrides,
  };
}

export function aQuote(overrides: Partial<StockQuote> = {}): StockQuote {
  return { ticker: 'AAPL', price: 150.25, previousClose: 148.5, percentChange: 1.18, ...overrides };
}

export function aQuotesResponse(overrides: Partial<StockQuotes> = {}): StockQuotes {
  const quotes = overrides.quotes ?? [aQuote()];

  return {
    quotes,
    unresolved: [],
    quoteCount: quotes.length,
    ...overrides,
  };
}

export function aQuoteTick(overrides: Partial<QuoteTickMessage> = {}): QuoteTickMessage {
  const quotes = overrides.quotes ?? [aQuote()];

  return {
    type: 'quotes',
    timestamp: '2026-08-18T09:14:02.117Z',
    quotes,
    unresolved: [],
    quoteCount: quotes.length,
    ...overrides,
  };
}

/** An RFC 9457 problem document, as the backend's GlobalExceptionHandler produces one. */
export function aProblemDetail(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'https://api.forinvest.com/problems/portfolio-not-found',
    title: 'Portfolio not found',
    status: 404,
    detail: 'Portfolio 3f8c… was not found',
    instance: '/api/v1/portfolios/3f8c…',
    timestamp: '2026-08-17T19:22:31.284Z',
    ...overrides,
  };
}
