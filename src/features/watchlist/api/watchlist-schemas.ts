import { z } from 'zod';

/**
 * The watchlist half of the API contract, mirroring `WatchlistEntryResponse` on the Java side.
 *
 * An entry is deliberately thin: an id and a symbol, and no price. Prices are not part of the
 * watchlist resource at all — they arrive over the quote feed and are merged in at render time — so
 * a schema that carried one would be inventing a field the backend never sends.
 */

export const watchlistEntrySchema = z.object({
  /** Server-assigned. It is what `DELETE /watchlist/{entryId}` takes, not the ticker. */
  id: z.string(),
  /** Stored and returned in upper case. */
  ticker: z.string(),
});

export const watchlistSchema = z.array(watchlistEntrySchema);

export type WatchlistEntry = z.infer<typeof watchlistEntrySchema>;

/**
 * The cap `AddWatchlistEntryRequest` enforces with `@Size(max = 10)`.
 *
 * Shorter than {@link TICKER_MAX_LENGTH} on the portfolio side, which is why it is its own constant
 * rather than a shared one: the two endpoints genuinely disagree, and the browser should refuse what
 * the server would refuse.
 */
export const WATCH_TICKER_MAX_LENGTH = 10;
