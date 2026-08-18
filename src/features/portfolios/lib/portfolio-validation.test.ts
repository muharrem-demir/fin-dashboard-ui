import { PORTFOLIO_NAME_MAX_LENGTH } from '../api/portfolio-schemas';

import { validatePortfolioName } from './portfolio-validation';

describe('validatePortfolioName', () => {
  it.each(['Growth', 'a', 'Long-Term Income & Dividends', 'A'.repeat(PORTFOLIO_NAME_MAX_LENGTH)])(
    'accepts %p',
    (name) => {
      expect(validatePortfolioName(name)).toBeUndefined();
    },
  );

  it.each(['', '   ', '\n\t'])('rejects %p as blank', (name) => {
    expect(validatePortfolioName(name)).toMatch(/give the portfolio a name/i);
  });

  it('measures length after trimming, matching what would be sent', () => {
    expect(validatePortfolioName(`  ${'A'.repeat(PORTFOLIO_NAME_MAX_LENGTH)}  `)).toBeUndefined();
    expect(validatePortfolioName('A'.repeat(PORTFOLIO_NAME_MAX_LENGTH + 1))).toMatch(/at most 100/i);
  });
});
