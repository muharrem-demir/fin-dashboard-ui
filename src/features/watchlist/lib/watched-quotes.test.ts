import { aQuote, aQuoteTick, aWatchlistEntry } from '../../../test/factories';

import {
  applyWatchlistTick,
  buildWatchedItems,
  emptyWatchlistQuoteState,
  normalizeTicker,
  watchedTickers,
} from './watched-quotes';

/**
 * The merge, as a table of cases.
 *
 * This is where a wrong price gets attached to a symbol, so the tests are about the joins: which card
 * wins when a tick arrives, what a card shows before one has, and what happens to a price whose symbol
 * has since been unwatched.
 */

describe('normalizeTicker', () => {
  it.each([
    ['aapl', 'AAPL'],
    ['  msft  ', 'MSFT'],
    ['BRK.B', 'BRK.B'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeTicker(input)).toBe(expected);
  });
});

describe('watchedTickers', () => {
  it('normalises, de-duplicates and sorts, so an unchanged list is not re-subscribed', () => {
    const entries = [
      aWatchlistEntry({ id: '1', ticker: 'msft' }),
      aWatchlistEntry({ id: '2', ticker: 'AAPL' }),
      aWatchlistEntry({ id: '3', ticker: 'aapl' }),
    ];

    expect(watchedTickers(entries)).toEqual(['AAPL', 'MSFT']);
  });

  it('answers an empty list for an empty watchlist', () => {
    expect(watchedTickers([])).toEqual([]);
  });
});

describe('applyWatchlistTick', () => {
  it('records the price and change of every quoted symbol', () => {
    const state = applyWatchlistTick(
      emptyWatchlistQuoteState,
      aQuoteTick({ quotes: [aQuote({ ticker: 'AAPL', price: 150.25, percentChange: 1.18 })] }),
      1000,
    );

    expect(state.byTicker.AAPL).toEqual({ price: 150.25, percentChange: 1.18, receivedAt: 1000 });
    expect(state.lastTickAt).toBe(1000);
  });

  it('keeps a symbol the newest tick did not mention', () => {
    const first = applyWatchlistTick(
      emptyWatchlistQuoteState,
      aQuoteTick({ quotes: [aQuote({ ticker: 'AAPL', price: 150 }), aQuote({ ticker: 'MSFT', price: 400 })] }),
      1000,
    );

    const second = applyWatchlistTick(first, aQuoteTick({ quotes: [aQuote({ ticker: 'AAPL', price: 151 })] }), 2000);

    expect(second.byTicker.AAPL?.price).toBe(151);
    expect(second.byTicker.MSFT?.price).toBe(400);
  });

  it('normalises the symbols the feed sends', () => {
    const state = applyWatchlistTick(
      emptyWatchlistQuoteState,
      aQuoteTick({ quotes: [aQuote({ ticker: 'aapl', price: 10 })], unresolved: ['zzzz'] }),
      1000,
    );

    expect(state.byTicker.AAPL?.price).toBe(10);
    expect(state.unresolved).toEqual(['ZZZZ']);
  });

  it('drops a symbol from unresolved once it prices, and never lists one twice', () => {
    const first = applyWatchlistTick(emptyWatchlistQuoteState, aQuoteTick({ quotes: [], unresolved: ['ZZZZ'] }), 1000);
    const second = applyWatchlistTick(first, aQuoteTick({ quotes: [], unresolved: ['ZZZZ'] }), 2000);
    const third = applyWatchlistTick(second, aQuoteTick({ quotes: [aQuote({ ticker: 'ZZZZ', price: 1 })] }), 3000);

    expect(second.unresolved).toEqual(['ZZZZ']);
    expect(third.unresolved).toEqual([]);
  });

  it('leaves the state it was given untouched', () => {
    const before = applyWatchlistTick(emptyWatchlistQuoteState, aQuoteTick({ quotes: [aQuote({ price: 1 })] }), 1000);
    applyWatchlistTick(before, aQuoteTick({ quotes: [aQuote({ price: 2 })] }), 2000);

    expect(before.byTicker.AAPL?.price).toBe(1);
  });
});

describe('buildWatchedItems', () => {
  const entries = [aWatchlistEntry({ id: 'a', ticker: 'AAPL' }), aWatchlistEntry({ id: 'b', ticker: 'msft' })];

  it('shows a card per entry, upper-cased, before any price has arrived', () => {
    const items = buildWatchedItems(entries);

    expect(items.map((item) => item.ticker)).toEqual(['AAPL', 'MSFT']);
    expect(items.every((item) => item.status === 'pending' && item.price === undefined)).toBe(true);
  });

  it('attaches the live price and change to the matching card', () => {
    const live = applyWatchlistTick(
      emptyWatchlistQuoteState,
      aQuoteTick({ quotes: [aQuote({ ticker: 'MSFT', price: 402.5, percentChange: -0.4 })] }),
      1000,
    );

    const [apple, microsoft] = buildWatchedItems(entries, live);

    expect(microsoft).toMatchObject({ price: 402.5, percentChange: -0.4, status: 'live', updatedAt: 1000 });
    expect(apple).toMatchObject({ status: 'pending', price: undefined });
  });

  it('marks a symbol the provider had no data for as unavailable', () => {
    const live = applyWatchlistTick(emptyWatchlistQuoteState, aQuoteTick({ quotes: [], unresolved: ['AAPL'] }), 1000);

    expect(buildWatchedItems(entries, live)[0]).toMatchObject({ status: 'unavailable', price: undefined });
  });

  it('ignores a price whose symbol is no longer watched', () => {
    const live = applyWatchlistTick(
      emptyWatchlistQuoteState,
      aQuoteTick({ quotes: [aQuote({ ticker: 'TSLA', price: 900 })] }),
      1000,
    );

    const items = buildWatchedItems(entries, live);

    expect(items).toHaveLength(2);
    expect(items.some((item) => item.ticker === 'TSLA')).toBe(false);
  });

  it('keeps the entry id, because that is what removal is keyed on', () => {
    expect(buildWatchedItems(entries).map((item) => item.id)).toEqual(['a', 'b']);
  });
});
