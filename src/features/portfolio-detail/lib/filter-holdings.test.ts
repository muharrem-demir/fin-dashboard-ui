import { buildHoldings } from './holdings';
import { aStock } from '../../../test/factories';

import { filterHoldings } from './filter-holdings';

const holdings = buildHoldings({
  stocks: [
    aStock({ ticker: 'AAPL' }),
    aStock({ ticker: 'MSFT' }),
    aStock({ ticker: 'GOOGL' }),
    aStock({ ticker: 'AMZN' }),
  ],
});

function tickersFor(query: string): readonly string[] {
  return filterHoldings(holdings, query).map((holding) => holding.ticker);
}

describe('filterHoldings', () => {
  it.each([
    ['an empty query keeps every row', '', ['AAPL', 'MSFT', 'GOOGL', 'AMZN']],
    ['whitespace alone keeps every row', '   ', ['AAPL', 'MSFT', 'GOOGL', 'AMZN']],
    ['an exact ticker keeps only that row', 'MSFT', ['MSFT']],
    ['a prefix matches', 'A', ['AAPL', 'AMZN']],
    ['a substring matches anywhere in the ticker', 'OOG', ['GOOGL']],
    ['a suffix matches', 'ZN', ['AMZN']],
    ['matching is case-insensitive', 'aapl', ['AAPL']],
    ['leading and trailing spaces are trimmed off the query', '  msft  ', ['MSFT']],
    ['mixed case with surrounding spaces still matches', ' GoOg ', ['GOOGL']],
    ['a query nothing contains matches nothing', 'TSLA', []],
    ['inner spaces are not trimmed, so they cannot match a ticker', 'AA PL', []],
  ])('%s', (_name, query, expected) => {
    expect(tickersFor(query)).toEqual(expected);
  });

  it('returns the holdings unchanged for an empty query rather than a copy', () => {
    expect(filterHoldings(holdings, '  ')).toBe(holdings);
  });

  it('preserves the order the portfolio defines', () => {
    expect(tickersFor('m')).toEqual(['MSFT', 'AMZN']);
    expect(tickersFor('l')).toEqual(['AAPL', 'GOOGL']);
  });
});
