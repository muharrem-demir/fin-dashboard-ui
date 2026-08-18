import { PORTFOLIO_NAME_MAX_LENGTH } from '../api/portfolio-schemas';

/**
 * The same rules the backend's bean validation applies, checked before a round trip.
 *
 * In its own module rather than beside the dialog that uses it, for two reasons: both the create and
 * the rename dialog need it, and a file that exports a component plus a helper cannot be hot-reloaded
 * by Fast Refresh.
 */
export function validatePortfolioName(raw: string): string | undefined {
  const name = raw.trim();

  if (name === '') {
    return 'Give the portfolio a name.';
  }

  if (name.length > PORTFOLIO_NAME_MAX_LENGTH) {
    return `Use at most ${String(PORTFOLIO_NAME_MAX_LENGTH)} characters.`;
  }

  return undefined;
}
