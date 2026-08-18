import { validateAddStock } from './add-stock-validation';

/**
 * The add-holding rules, as a table.
 *
 * Worth testing directly rather than only through the form: these mirror the backend's bean validation, and
 * the pairs below are exactly the inputs where a naive check disagrees with the server — `10.5` and `1e3`
 * both survive `Number()`, and a symbol like `BRK.B` is valid despite containing punctuation.
 */
describe('validateAddStock', () => {
  describe('tickers it accepts', () => {
    it.each(['AAPL', 'aapl', 'BRK.B', 'RDS-A', 'A', '^GSPC'.slice(1), 'MSFT '])('accepts %p', (ticker) => {
      expect(validateAddStock(ticker, '1').ticker).toBeUndefined();
    });
  });

  describe('tickers it rejects', () => {
    it('rejects an empty ticker', () => {
      expect(validateAddStock('', '1').ticker).toMatch(/enter a ticker/i);
      expect(validateAddStock('   ', '1').ticker).toMatch(/enter a ticker/i);
    });

    it('rejects a ticker over the length the API accepts', () => {
      expect(validateAddStock('A'.repeat(17), '1').ticker).toMatch(/at most 16/i);
    });

    it.each(['1AAPL', 'AA PL', 'AA$PL', '.AAPL'])('rejects %p', (ticker) => {
      expect(validateAddStock(ticker, '1').ticker).toMatch(/letters, digits/i);
    });
  });

  describe('share counts', () => {
    it.each(['1', '10', '999999'])('accepts %p', (shares) => {
      expect(validateAddStock('AAPL', shares).shares).toBeUndefined();
    });

    it('rejects an empty count', () => {
      expect(validateAddStock('AAPL', '').shares).toMatch(/enter a number/i);
    });

    it.each(['2.5', '1e3', '0x10', '-', 'ten', ' 1 2 '])('rejects %p as not a whole number', (shares) => {
      expect(validateAddStock('AAPL', shares).shares).toMatch(/whole number/i);
    });

    it('rejects zero, which the API requires to be positive', () => {
      expect(validateAddStock('AAPL', '0').shares).toMatch(/greater than zero/i);
    });

    it('rejects a count too large to represent exactly', () => {
      expect(validateAddStock('AAPL', '9'.repeat(20)).shares).toMatch(/more shares than/i);
    });
  });

  it('reports both fields at once, so the form does not fix them one round trip at a time', () => {
    expect(validateAddStock('', 'abc')).toEqual({
      ticker: expect.stringMatching(/enter a ticker/i),
      shares: expect.stringMatching(/whole number/i),
    });
  });

  it('returns an empty object for valid input', () => {
    expect(validateAddStock('AAPL', '10')).toEqual({});
  });
});
