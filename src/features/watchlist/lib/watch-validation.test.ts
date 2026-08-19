import { validateWatchTicker } from './watch-validation';

/** The same table the add-holding rules get: one row per way a symbol can be wrong. */
describe('validateWatchTicker', () => {
  it.each(['AAPL', 'aapl', '  msft  ', 'BRK.B', 'RDS-A', 'GSPC'])('accepts %s', (ticker) => {
    expect(validateWatchTicker(ticker)).toBeUndefined();
  });

  it.each([
    ['', 'Enter a ticker symbol.'],
    ['   ', 'Enter a ticker symbol.'],
    ['TOOLONGSYMBOL', 'Use at most 10 characters.'],
    ['1AAPL', 'Use letters, digits, dots or hyphens — for example AAPL or BRK.B.'],
    ['AA PL', 'Use letters, digits, dots or hyphens — for example AAPL or BRK.B.'],
    ['AA$PL', 'Use letters, digits, dots or hyphens — for example AAPL or BRK.B.'],
  ])('rejects %p', (ticker, message) => {
    expect(validateWatchTicker(ticker)).toBe(message);
  });
});
