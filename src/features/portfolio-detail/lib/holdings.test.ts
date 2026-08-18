import { aQuote, aQuoteTick, aQuotesResponse, aStock } from '../../../test/factories';

import {
  applyQuoteTick,
  buildHoldings,
  emptyLiveQuoteState,
  normalizeTicker,
  portfolioValue,
  weightedPercentChange,
} from './holdings';

/**
 * These are the tests that matter most in the suite.
 *
 * Total value is the number a user would act on, and it is derived from three inputs that update
 * independently — shares from REST, the opening price batch, and the live feed. Every case below is a way
 * that derivation could go quietly wrong.
 */
describe('buildHoldings', () => {
  it('multiplies shares by price to get total value', () => {
    const [holding] = buildHoldings({
      stocks: [aStock({ ticker: 'AAPL', shares: 15 })],
      batch: aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 150.25 })] }),
    });

    expect(holding?.totalValue).toBeCloseTo(2253.75, 5);
  });

  it('leaves total value undefined until a price arrives, rather than reporting zero', () => {
    const [holding] = buildHoldings({ stocks: [aStock({ shares: 10 })] });

    expect(holding?.totalValue).toBeUndefined();
    expect(holding?.quoteStatus).toBe('pending');
  });

  it('distinguishes a symbol the provider has no data for from one still awaiting its first price', () => {
    const holdings = buildHoldings({
      stocks: [aStock({ ticker: 'NOSUCH' }), aStock({ ticker: 'AAPL' })],
      batch: aQuotesResponse({ quotes: [], unresolved: ['NOSUCH'] }),
    });

    expect(holdings[0]?.quoteStatus).toBe('unavailable');
    expect(holdings[1]?.quoteStatus).toBe('pending');
  });

  it('matches quotes case-insensitively, as the API normalises symbols to upper case', () => {
    const [holding] = buildHoldings({
      stocks: [aStock({ ticker: 'aapl', shares: 2 })],
      batch: aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100 })] }),
    });

    expect(holding?.ticker).toBe('AAPL');
    expect(holding?.totalValue).toBe(200);
  });

  it('omits percent change when the API omitted it, instead of showing a flat zero', () => {
    const [holding] = buildHoldings({
      stocks: [aStock()],
      batch: aQuotesResponse({ quotes: [{ ticker: 'AAPL', price: 100 }] }),
    });

    expect(holding?.percentChange).toBeUndefined();
  });

  it('is driven by the holdings list, so a quote for a ticker no longer held adds no row', () => {
    const holdings = buildHoldings({
      stocks: [aStock({ ticker: 'AAPL' })],
      batch: aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL' }), aQuote({ ticker: 'TSLA' })] }),
    });

    expect(holdings).toHaveLength(1);
  });

  it('shows a re-added ticker as pending rather than wearing a price left over from the live layer', () => {
    // TSLA was held, ticked, then removed. Its snapshot is still in the live layer, but the holding is
    // gone — so re-adding it must not present that stale price as live.
    const live = applyQuoteTick(emptyLiveQuoteState, {
      quotes: [aQuote({ ticker: 'TSLA', price: 42 })],
      unresolved: [],
    });

    const withoutTsla = buildHoldings({ stocks: [aStock({ ticker: 'AAPL' })], live });
    expect(withoutTsla).toHaveLength(1);
    expect(withoutTsla[0]?.ticker).toBe('AAPL');
  });

  it('prefers a live price over the batch price for the same symbol', () => {
    const live = applyQuoteTick(
      emptyLiveQuoteState,
      { quotes: [aQuote({ ticker: 'AAPL', price: 200, percentChange: 33.3 })], unresolved: [] },
      2000,
    );

    const [holding] = buildHoldings({
      stocks: [aStock({ ticker: 'AAPL', shares: 10 })],
      batch: aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100, percentChange: 1 })] }),
      live,
    });

    expect(holding?.price).toBe(200);
    expect(holding?.percentChange).toBe(33.3);
    expect(holding?.totalValue).toBe(2000);
  });

  it('falls back to the batch price for a symbol the feed has not sent yet', () => {
    const live = applyQuoteTick(emptyLiveQuoteState, {
      quotes: [aQuote({ ticker: 'AAPL', price: 200 })],
      unresolved: [],
    });

    const [, msft] = buildHoldings({
      stocks: [aStock({ ticker: 'AAPL' }), aStock({ ticker: 'MSFT', shares: 4 })],
      batch: aQuotesResponse({
        quotes: [aQuote({ ticker: 'AAPL', price: 100 }), aQuote({ ticker: 'MSFT', price: 50 })],
      }),
      live,
    });

    expect(msft?.price).toBe(50);
    expect(msft?.totalValue).toBe(200);
  });

  describe('price movement', () => {
    it('compares the first tick against the opening batch price, so an early move still flashes', () => {
      const batch = aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100 })] });
      const live = applyQuoteTick(emptyLiveQuoteState, {
        quotes: [aQuote({ ticker: 'AAPL', price: 110 })],
        unresolved: [],
      });

      const [holding] = buildHoldings({ stocks: [aStock()], batch, live });

      expect(holding?.move).toBe('up');
    });

    it('compares later ticks against the previous tick', () => {
      const first = applyQuoteTick(emptyLiveQuoteState, { quotes: [aQuote({ price: 100 })], unresolved: [] }, 1000);
      const second = applyQuoteTick(first, { quotes: [aQuote({ price: 90 })], unresolved: [] }, 2000);

      expect(buildHoldings({ stocks: [aStock()], live: second })[0]?.move).toBe('down');
    });

    it('reports no move when a tick repeats the same price', () => {
      const first = applyQuoteTick(emptyLiveQuoteState, { quotes: [aQuote({ price: 100 })], unresolved: [] }, 1000);
      const second = applyQuoteTick(first, { quotes: [aQuote({ price: 100 })], unresolved: [] }, 2000);

      // Flashing on an unchanged price would make the signal meaningless.
      expect(buildHoldings({ stocks: [aStock()], live: second })[0]?.move).toBeNull();
    });

    it('reports no move for a symbol with no basis to compare against', () => {
      const live = applyQuoteTick(emptyLiveQuoteState, aQuoteTick(), 1000);

      expect(buildHoldings({ stocks: [aStock()], live })[0]?.move).toBeNull();
    });

    it('reports no move for a batch price alone — the first prices of a session are not a movement', () => {
      const [holding] = buildHoldings({
        stocks: [aStock()],
        batch: aQuotesResponse({ quotes: [aQuote({ price: 100 })] }),
      });

      expect(holding?.move).toBeNull();
    });
  });
});

describe('applyQuoteTick', () => {
  const seeded = applyQuoteTick(
    emptyLiveQuoteState,
    { quotes: [aQuote({ ticker: 'AAPL', price: 150 }), aQuote({ ticker: 'MSFT', price: 200 })], unresolved: [] },
    1000,
  );

  it('updates price, percent change and total value together', () => {
    const next = applyQuoteTick(
      seeded,
      { quotes: [aQuote({ ticker: 'AAPL', price: 160, percentChange: 7.74 })], unresolved: [] },
      2000,
    );

    const [holding] = buildHoldings({ stocks: [aStock({ ticker: 'AAPL', shares: 10 })], live: next });

    expect(holding?.price).toBe(160);
    expect(holding?.percentChange).toBe(7.74);
    expect(holding?.totalValue).toBe(1600);
  });

  it('merges rather than replaces, so a tick omitting a symbol leaves its last price standing', () => {
    const next = applyQuoteTick(seeded, { quotes: [aQuote({ ticker: 'AAPL', price: 160 })], unresolved: [] }, 2000);

    expect(next.byTicker.MSFT?.price).toBe(200);
  });

  it('updates shares when a tick carries them, and keeps the REST value when it does not', () => {
    const withShares = applyQuoteTick(
      seeded,
      { quotes: [{ ...aQuote({ ticker: 'AAPL', price: 150 }), shares: 42 }], unresolved: [] },
      2000,
    );

    const [updated] = buildHoldings({ stocks: [aStock({ ticker: 'AAPL', shares: 10 })], live: withShares });
    expect(updated?.shares).toBe(42);
    expect(updated?.totalValue).toBe(6300);

    const withoutShares = applyQuoteTick(
      seeded,
      { quotes: [aQuote({ ticker: 'AAPL', price: 150 })], unresolved: [] },
      3000,
    );
    const [unchanged] = buildHoldings({ stocks: [aStock({ ticker: 'AAPL', shares: 10 })], live: withoutShares });
    expect(unchanged?.shares).toBe(10);
  });

  it('carries shares forward across a tick that omits them', () => {
    const withShares = applyQuoteTick(
      seeded,
      { quotes: [{ ...aQuote({ price: 150 }), shares: 42 }], unresolved: [] },
      2000,
    );
    const later = applyQuoteTick(withShares, { quotes: [aQuote({ price: 151 })], unresolved: [] }, 3000);

    expect(later.byTicker.AAPL?.shares).toBe(42);
  });

  it('clears a symbol from unresolved once the provider starts returning it', () => {
    const unresolved = applyQuoteTick(emptyLiveQuoteState, { quotes: [], unresolved: ['NOSUCH'] }, 1000);
    expect(unresolved.unresolved).toContain('NOSUCH');

    const resolved = applyQuoteTick(
      unresolved,
      { quotes: [aQuote({ ticker: 'NOSUCH', price: 5 })], unresolved: [] },
      2000,
    );
    expect(resolved.unresolved).not.toContain('NOSUCH');
  });

  it('keeps the last known price when a provider hiccup marks a symbol unresolved', () => {
    const next = applyQuoteTick(seeded, { quotes: [], unresolved: ['AAPL'] }, 2000);

    // The row shows a stale price rather than blanking, which is the lesser of two evils on a
    // three-second feed.
    expect(next.byTicker.AAPL?.price).toBe(150);
  });

  it('records the tick timestamp so the UI can show the age of the data', () => {
    expect(applyQuoteTick(seeded, aQuoteTick(), 4242).lastTickAt).toBe(4242);
  });

  it('leaves the previous state untouched', () => {
    applyQuoteTick(seeded, { quotes: [aQuote({ ticker: 'AAPL', price: 999 })], unresolved: [] }, 2000);

    expect(seeded.byTicker.AAPL?.price).toBe(150);
  });
});

describe('portfolioValue', () => {
  it('sums the priced positions and reports the total as incomplete', () => {
    const holdings = buildHoldings({
      stocks: [aStock({ ticker: 'AAPL', shares: 3 }), aStock({ ticker: 'MSFT', shares: 5 })],
      batch: aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100 })] }),
    });

    const value = portfolioValue(holdings);

    expect(value.total).toBe(300);
    expect(value.pricedCount).toBe(1);
    expect(value.complete).toBe(false);
  });

  it('is complete when every position is priced', () => {
    const value = portfolioValue(
      buildHoldings({
        stocks: [aStock({ ticker: 'AAPL', shares: 1 }), aStock({ ticker: 'MSFT', shares: 1 })],
        batch: aQuotesResponse({
          quotes: [aQuote({ ticker: 'AAPL', price: 100 }), aQuote({ ticker: 'MSFT', price: 200 })],
        }),
      }),
    );

    expect(value.total).toBe(300);
    expect(value.complete).toBe(true);
  });

  it('treats an empty portfolio as a complete zero', () => {
    expect(portfolioValue([])).toEqual({ total: 0, pricedCount: 0, complete: true });
  });
});

describe('weightedPercentChange', () => {
  it('weights each position by its value, not by count', () => {
    // 900 of BIG at +10% against 100 of SMALL at -10% is +8%, not 0%.
    const holdings = buildHoldings({
      stocks: [aStock({ ticker: 'BIG', shares: 9 }), aStock({ ticker: 'SMALL', shares: 1 })],
      batch: aQuotesResponse({
        quotes: [
          aQuote({ ticker: 'BIG', price: 100, percentChange: 10 }),
          aQuote({ ticker: 'SMALL', price: 100, percentChange: -10 }),
        ],
      }),
    });

    expect(weightedPercentChange(holdings)).toBeCloseTo(8, 5);
  });

  it('is undefined when nothing has a change to weight', () => {
    expect(weightedPercentChange(buildHoldings({ stocks: [aStock()] }))).toBeUndefined();
  });
});

describe('normalizeTicker', () => {
  it.each([
    ['aapl', 'AAPL'],
    ['  msft  ', 'MSFT'],
    ['brk.b', 'BRK.B'],
    ['', ''],
  ])('normalises %p to %p', (input, expected) => {
    expect(normalizeTicker(input)).toBe(expected);
  });
});
