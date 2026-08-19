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

/**
 * One trading day's close.
 *
 * `date` is a `LocalDate` on the wire — `2026-08-14`, no time and no zone — so it is validated as a
 * calendar date and kept as a string. Turning it into a `Date` here would drag the browser's timezone
 * into a value that has none, and "the close on the 14th" would render as the 13th for anyone west of
 * UTC. It is parsed as UTC at the point it is formatted instead.
 */
export const pricePointSchema = z.object({
  date: z.iso.date(),
  close: z.number(),
});

/**
 * Recent daily closes for one ticker, oldest first.
 *
 * `days` is the window the deployment is configured for, not the number of points: the backend sends
 * fewer when the provider had fewer, and says so by reporting the window it asked for.
 */
export const priceHistorySchema = z.object({
  ticker: z.string(),
  days: z.number().int(),
  points: z.array(pricePointSchema),
});

export const stockQuotesSchema = z.object({
  quotes: z.array(stockQuoteSchema),
  /** Tickers the provider had no data for — "no data" as distinct from "not asked for". */
  unresolved: z.array(z.string()),
  quoteCount: z.number().int(),
  /**
   * Optional because its absence is meaningful: the field is omitted when `history=true` was not
   * requested, and present-but-empty when it was and the provider had nothing. A ticker with no
   * history is left out of the array rather than sent with zero points.
   */
  history: z.array(priceHistorySchema).optional(),
});

export type StockQuote = z.infer<typeof stockQuoteSchema>;
export type PricePoint = z.infer<typeof pricePointSchema>;
export type PriceHistory = z.infer<typeof priceHistorySchema>;
export type StockQuotes = z.infer<typeof stockQuotesSchema>;

/** The backend caps a batch request and a stream subscription at the same number of symbols. */
export const MAX_TICKERS_PER_REQUEST = 50;
