import { z } from 'zod';

/**
 * The quote half of the API contract.
 *
 * `previousClose` and `percentChange` are both optional, and that is a real distinction rather than
 * defensive slack: the backend omits `percentChange` entirely when the previous close is unknown or
 * zero, precisely so a client does not report a misleading `0.00%`. The UI honours that by rendering
 * an em dash for an absent change rather than a flat zero.
 */

export const stockQuoteSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  previousClose: z.number().optional(),
  percentChange: z.number().optional(),
});

export const stockQuotesSchema = z.object({
  quotes: z.array(stockQuoteSchema),
  /** Tickers the provider had no data for — "no data" as distinct from "not asked for". */
  unresolved: z.array(z.string()),
  quoteCount: z.number().int(),
});

export type StockQuote = z.infer<typeof stockQuoteSchema>;
export type StockQuotes = z.infer<typeof stockQuotesSchema>;

/** The backend caps a batch request and a stream subscription at the same number of symbols. */
export const MAX_TICKERS_PER_REQUEST = 50;
