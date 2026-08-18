import { aQuote, aQuotesResponse, aStock } from '../../../test/factories';

import { buildHoldings } from './holdings';
import { DEFAULT_SORT, DEFAULT_SORT_DIRECTION, nextSort, sortHoldings, type HoldingSort } from './sort-holdings';

/**
 * A portfolio chosen so no two columns agree on an order.
 *
 * AAPL is the biggest position by value but not by shares; ZM has the highest price and the smallest
 * holding; NODATA has no quote at all, which is the case every sort has to place deliberately.
 */
const holdings = buildHoldings({
  stocks: [
    aStock({ ticker: 'MSFT', shares: 20 }),
    aStock({ ticker: 'AAPL', shares: 15 }),
    aStock({ ticker: 'ZM', shares: 2 }),
    aStock({ ticker: 'NODATA', shares: 100 }),
  ],
  batch: aQuotesResponse({
    quotes: [
      aQuote({ ticker: 'MSFT', price: 100, percentChange: 2.5 }),
      aQuote({ ticker: 'AAPL', price: 200, percentChange: -1 }),
      aQuote({ ticker: 'ZM', price: 300, percentChange: 0.5 }),
    ],
    unresolved: ['NODATA'],
  }),
});

function order(sort: HoldingSort): readonly string[] {
  return sortHoldings(holdings, sort).map((holding) => holding.ticker);
}

describe('sortHoldings', () => {
  it('defaults to ticker, ascending', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'ticker', direction: 'asc' });
    expect(order(DEFAULT_SORT)).toEqual(['AAPL', 'MSFT', 'NODATA', 'ZM']);
  });

  it.each([
    // shares:   MSFT 20, AAPL 15, ZM 2, NODATA 100
    // price:    MSFT 100, AAPL 200, ZM 300, NODATA —
    // change:   MSFT +2.5, AAPL -1, ZM +0.5, NODATA —
    // value:    MSFT 2000, AAPL 3000, ZM 600, NODATA —
    ['ticker ascending is alphabetical', 'ticker', 'asc', ['AAPL', 'MSFT', 'NODATA', 'ZM']],
    ['ticker descending reverses it', 'ticker', 'desc', ['ZM', 'NODATA', 'MSFT', 'AAPL']],
    ['shares ascending', 'shares', 'asc', ['ZM', 'AAPL', 'MSFT', 'NODATA']],
    ['shares descending', 'shares', 'desc', ['NODATA', 'MSFT', 'AAPL', 'ZM']],
    ['price ascending', 'price', 'asc', ['MSFT', 'AAPL', 'ZM', 'NODATA']],
    ['price descending', 'price', 'desc', ['ZM', 'AAPL', 'MSFT', 'NODATA']],
    ['percent change ascending puts the loser first', 'percentChange', 'asc', ['AAPL', 'ZM', 'MSFT', 'NODATA']],
    ['percent change descending puts the winner first', 'percentChange', 'desc', ['MSFT', 'ZM', 'AAPL', 'NODATA']],
    ['total value ascending', 'totalValue', 'asc', ['ZM', 'MSFT', 'AAPL', 'NODATA']],
    ['total value descending', 'totalValue', 'desc', ['AAPL', 'MSFT', 'ZM', 'NODATA']],
  ] as const)('%s', (_name, key, direction, expected) => {
    expect(order({ key, direction })).toEqual(expected);
  });

  it.each(['price', 'percentChange', 'totalValue'] as const)(
    'sorts an unpriced position last by %s in both directions, never as if it were zero',
    (key) => {
      expect(order({ key, direction: 'asc' }).at(-1)).toBe('NODATA');
      expect(order({ key, direction: 'desc' }).at(-1)).toBe('NODATA');
    },
  );

  it('breaks ties on ticker so a re-sort on every tick cannot make rows swap places', () => {
    const tied = buildHoldings({
      stocks: [aStock({ ticker: 'TSLA', shares: 10 }), aStock({ ticker: 'AMD', shares: 10 })],
    });

    expect(sortHoldings(tied, { key: 'shares', direction: 'asc' }).map((holding) => holding.ticker)).toEqual([
      'AMD',
      'TSLA',
    ]);
    expect(sortHoldings(tied, { key: 'shares', direction: 'desc' }).map((holding) => holding.ticker)).toEqual([
      'AMD',
      'TSLA',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const before = holdings.map((holding) => holding.ticker);

    sortHoldings(holdings, { key: 'ticker', direction: 'desc' });

    expect(holdings.map((holding) => holding.ticker)).toEqual(before);
  });
});

describe('nextSort', () => {
  it('opens a newly clicked column at its default direction', () => {
    expect(nextSort(DEFAULT_SORT, 'totalValue')).toEqual({ key: 'totalValue', direction: 'desc' });
    expect(nextSort({ key: 'ticker', direction: 'desc' }, 'shares')).toEqual({ key: 'shares', direction: 'desc' });
    expect(nextSort({ key: 'shares', direction: 'asc' }, 'ticker')).toEqual({ key: 'ticker', direction: 'asc' });
  });

  it('flips the direction when the active column is clicked again', () => {
    expect(nextSort({ key: 'shares', direction: 'desc' }, 'shares')).toEqual({ key: 'shares', direction: 'asc' });
    expect(nextSort({ key: 'shares', direction: 'asc' }, 'shares')).toEqual({ key: 'shares', direction: 'desc' });
  });

  it('opens the numeric columns largest-first and the ticker A to Z', () => {
    expect(DEFAULT_SORT_DIRECTION).toEqual({
      ticker: 'asc',
      shares: 'desc',
      price: 'desc',
      percentChange: 'desc',
      totalValue: 'desc',
    });
  });
});
