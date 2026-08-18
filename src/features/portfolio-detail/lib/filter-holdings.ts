import type { Holding } from './holdings';

/**
 * Narrowing the holdings table by ticker.
 *
 * Pure and separate from {@link ./holdings.ts holdings.ts} on purpose: this is a view concern and nothing
 * else. Filtering must never reach the subscription list, the batch request or the portfolio totals — the
 * portfolio is still worth what it is worth while the user is looking at one row of it.
 */

/**
 * The rows whose ticker contains `query`.
 *
 * The query is trimmed at both ends and matched case-insensitively, so a stray space from a paste or a
 * lower-case `aapl` still finds AAPL. An empty or whitespace-only query matches everything rather than
 * nothing — "I have not typed anything" is not "nothing matches".
 */
export function filterHoldings(holdings: readonly Holding[], query: string): readonly Holding[] {
  const needle = query.trim().toUpperCase();

  if (needle === '') {
    return holdings;
  }

  return holdings.filter((holding) => holding.ticker.toUpperCase().includes(needle));
}
