import { request } from '../../../shared/api/http-client';

import { watchlistEntrySchema, watchlistSchema, type WatchlistEntry } from './watchlist-schemas';

/**
 * One function per watchlist endpoint, and nothing else.
 *
 * Plain async functions with no React in sight, exactly like `portfolio-api.ts`, so the hooks in
 * `watchlist-queries.ts` stay thin and these can be mocked as the seam in a component test.
 */

export function listWatchlist(signal?: AbortSignal): Promise<readonly WatchlistEntry[]> {
  return request({
    path: '/watchlist',
    schema: watchlistSchema,
    signal,
  });
}

/**
 * Starts watching a symbol.
 *
 * Case does not matter — the backend upper-cases before it stores — and a ticker already on the list
 * is a 409 rather than a second entry, which is why the caller reports a conflict as "already
 * watching" instead of as a failure.
 */
export function addWatchlistEntry(ticker: string): Promise<WatchlistEntry> {
  return request({
    method: 'POST',
    path: '/watchlist',
    body: { ticker },
    schema: watchlistEntrySchema,
  });
}

/** Keyed on the entry id, not the ticker. Answers 404 when the entry is already gone. */
export function removeWatchlistEntry(entryId: string): Promise<void> {
  return request({
    method: 'DELETE',
    path: `/watchlist/${encodeURIComponent(entryId)}`,
  });
}
