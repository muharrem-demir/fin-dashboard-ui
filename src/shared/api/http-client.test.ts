import { z } from 'zod';

import { aProblemDetail } from '../../test/factories';

import { ApiError } from './api-error';
import { request } from './http-client';

/**
 * The HTTP client's error normalisation.
 *
 * Every branch here corresponds to a failure a user can actually hit — the backend down, a validation
 * rejection, a contract that drifted — and the point of each test is that the failure arrives as an
 * `ApiError` carrying something worth showing, rather than as a raw `TypeError`.
 *
 * `api.baseUrl` comes from config/config.test.yaml: http://api.test/api/v1
 */
describe('request', () => {
  const schema = z.object({ id: z.string(), name: z.string() });

  function respondWith(body: unknown, init: ResponseInit = {}): jest.Mock {
    const mock = jest.fn().mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        ...init,
      }),
    );

    globalThis.fetch = mock;

    return mock;
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves a validated body', async () => {
    respondWith({ id: '1', name: 'Growth' });

    await expect(request({ path: '/portfolios/1', schema })).resolves.toEqual({ id: '1', name: 'Growth' });
  });

  it('builds the URL from the configured base path', async () => {
    const fetchMock = respondWith({ id: '1', name: 'Growth' });

    await request({ path: '/portfolios/1', schema });

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/v1/portfolios/1', expect.anything());
  });

  it('joins array query parameters with commas, as the quotes endpoint expects', async () => {
    const fetchMock = respondWith({ id: '1', name: 'Growth' });

    await request({ path: '/stocks/quotes', query: { tickers: ['AAPL', 'MSFT'] }, schema });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/stocks/quotes?tickers=AAPL%2CMSFT');
  });

  it('omits an empty array rather than sending tickers=', async () => {
    const fetchMock = respondWith({ id: '1', name: 'Growth' });

    await request({ path: '/stocks/quotes', query: { tickers: [] }, schema });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/stocks/quotes');
  });

  it('serialises a JSON body and sets the content type', async () => {
    const fetchMock = respondWith({ id: '1', name: 'Growth' });

    await request({ method: 'POST', path: '/portfolios', body: { name: 'Growth' }, schema });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"Growth"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('sends no body or content type on a GET', async () => {
    const fetchMock = respondWith({ id: '1', name: 'Growth' });

    await request({ path: '/portfolios/1', schema });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('resolves with nothing for a 204, without trying to parse a body', async () => {
    respondWith(undefined, { status: 204 });

    await expect(request({ method: 'DELETE', path: '/portfolios/1' })).resolves.toBeUndefined();
  });

  describe('problem documents', () => {
    it('prefers the specific detail over the generic title', async () => {
      respondWith(aProblemDetail(), { status: 404 });

      const error = (await request({ path: '/portfolios/1', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.kind).toBe('http');
      expect(error.status).toBe(404);
      expect(error.message).toBe('Portfolio 3f8c… was not found');
      expect(error.isNotFound).toBe(true);
      // A 404 will not become a 200 on retry.
      expect(error.isRetryable).toBe(false);
    });

    it('summarises field violations, which say more than the generic validation detail', async () => {
      respondWith(
        aProblemDetail({
          status: 400,
          title: 'Validation failed',
          detail: 'One or more fields are invalid.',
          errors: [
            { field: 'shares', message: 'shares must be greater than zero' },
            { field: 'ticker', message: 'ticker must not be blank' },
          ],
        }),
        { status: 400 },
      );

      const error = (await request({ method: 'POST', path: '/portfolios/1/stocks', body: {}, schema }).catch(
        (thrown: unknown) => thrown,
      )) as ApiError;

      expect(error.message).toBe('shares: shares must be greater than zero, ticker: ticker must not be blank');
      expect(error.isValidation).toBe(true);
      expect(error.fieldErrors).toHaveLength(2);
    });

    it('falls back to a status-appropriate sentence when the body is not a problem document', async () => {
      respondWith(undefined, { status: 502, statusText: 'Bad Gateway' });

      const error = (await request({ path: '/stocks/quotes', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.message).toBe('Market data is temporarily unavailable.');
      expect(error.isUpstreamUnavailable).toBe(true);
      // A 5xx may well recover, so retrying is reasonable.
      expect(error.isRetryable).toBe(true);
    });

    it('survives an HTML error page from a proxy', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(
        new Response('<html><body>504 Gateway Time-out</body></html>', {
          status: 504,
          headers: { 'Content-Type': 'text/html' },
        }),
      );

      const error = (await request({ path: '/portfolios', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(504);
    });

    it('marks a 5xx as retryable and a 4xx as not', async () => {
      respondWith(aProblemDetail({ status: 500 }), { status: 500 });
      const server = (await request({ path: '/portfolios', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      respondWith(aProblemDetail({ status: 409 }), { status: 409 });
      const conflict = (await request({ path: '/portfolios', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(server.isRetryable).toBe(true);
      expect(conflict.isRetryable).toBe(false);
    });
  });

  describe('transport failures', () => {
    it('reports an unreachable server as a network error', async () => {
      globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const error = (await request({ path: '/portfolios', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.kind).toBe('network');
      expect(error.message).toContain('Could not reach the server');
      expect(error.isRetryable).toBe(true);
    });

    it('reports a timeout distinctly from a network failure', async () => {
      globalThis.fetch = jest.fn().mockRejectedValue(new DOMException('Request timed out', 'TimeoutError'));

      const error = (await request({ path: '/portfolios', schema, timeoutMs: 50 }).catch(
        (thrown: unknown) => thrown,
      )) as ApiError;

      expect(error.kind).toBe('timeout');
      expect(error.message).toContain('did not respond');
    });

    it('reports a caller-cancelled request as aborted, not as a failure to report', async () => {
      const controller = new AbortController();
      controller.abort();

      globalThis.fetch = jest.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

      const error = (await request({ path: '/portfolios', schema, signal: controller.signal }).catch(
        (thrown: unknown) => thrown,
      )) as ApiError;

      expect(error.kind).toBe('aborted');
    });
  });

  describe('contract drift', () => {
    // A schema mismatch is logged at error level on purpose — whoever changed the contract needs to
    // see which field moved — so the expected log line is silenced rather than left as test noise.
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('rejects a 200 whose body does not match the schema', async () => {
      // `name` is a number: exactly the kind of change that would otherwise render as "[object Object]".
      respondWith({ id: '1', name: 42 });

      const error = (await request({ path: '/portfolios/1', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.kind).toBe('parse');
      expect(error.message).toBe('The server returned unexpected data.');
    });

    it('rejects a 200 that is not JSON at all', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue(new Response('not json', { status: 200 }));

      const error = (await request({ path: '/portfolios/1', schema }).catch((thrown: unknown) => thrown)) as ApiError;

      expect(error.kind).toBe('parse');
    });
  });
});
