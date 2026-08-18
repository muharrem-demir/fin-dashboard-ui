import { TICKER_MAX_LENGTH } from '../../portfolios/api/portfolio-schemas';

export interface AddStockErrors {
  readonly ticker?: string;
  readonly shares?: string;
}

/**
 * Validates the add-holding form.
 *
 * Pure and separate from the form so the rules can be tested as a table of inputs rather than by typing
 * into a rendered component.
 *
 * The ticker pattern is intentionally permissive about dots and hyphens: real symbols include `BRK.B`
 * and `RDS-A`, and rejecting them client-side would block holdings the API accepts.
 */
export function validateAddStock(rawTicker: string, rawShares: string): AddStockErrors {
  const errors: { ticker?: string; shares?: string } = {};
  const ticker = rawTicker.trim();

  if (ticker === '') {
    errors.ticker = 'Enter a ticker symbol.';
  } else if (ticker.length > TICKER_MAX_LENGTH) {
    errors.ticker = `Use at most ${String(TICKER_MAX_LENGTH)} characters.`;
  } else if (!/^[A-Za-z][A-Za-z0-9.\-^]*$/.test(ticker)) {
    errors.ticker = 'Use letters, digits, dots or hyphens — for example AAPL or BRK.B.';
  }

  const shares = rawShares.trim();

  if (shares === '') {
    errors.shares = 'Enter a number of shares.';
  } else if (!/^\d+$/.test(shares)) {
    // Checked as a string rather than with Number(): `1e3` and `10.5` both parse to finite numbers the
    // API would reject.
    errors.shares = 'Enter a whole number of shares.';
  } else if (Number(shares) < 1) {
    errors.shares = 'Shares must be greater than zero.';
  } else if (!Number.isSafeInteger(Number(shares))) {
    errors.shares = 'That is more shares than we can track.';
  }

  return errors;
}
