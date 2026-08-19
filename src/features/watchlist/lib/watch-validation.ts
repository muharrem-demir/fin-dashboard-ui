import { WATCH_TICKER_MAX_LENGTH } from '../api/watchlist-schemas';

/**
 * Validates the add-to-watchlist form.
 *
 * Pure and separate from the dialog so the rules are tested as a table of inputs rather than by typing
 * into a rendered component.
 *
 * The pattern is the permissive one the add-holding form uses — real symbols include `BRK.B` and
 * `RDS-A`, and rejecting those in the browser would block symbols the API accepts. The length limit is
 * the watchlist endpoint's own, which is shorter than the portfolio one.
 */
export function validateWatchTicker(raw: string): string | undefined {
  const ticker = raw.trim();

  if (ticker === '') {
    return 'Enter a ticker symbol.';
  }

  if (ticker.length > WATCH_TICKER_MAX_LENGTH) {
    return `Use at most ${String(WATCH_TICKER_MAX_LENGTH)} characters.`;
  }

  if (!/^[A-Za-z][A-Za-z0-9.\-^]*$/.test(ticker)) {
    return 'Use letters, digits, dots or hyphens — for example AAPL or BRK.B.';
  }

  return undefined;
}
