import type { z } from 'zod';

import { appConfig } from '../../config/app-config';
import { logger } from '../lib/logger';

import { ApiError } from './api-error';
import { toApiError } from './problem-detail';

/**
 * The single door to the backend.
 *
 * Everything a request can go wrong with is normalised here — timeouts, offline browsers, problem
 * documents, responses whose shape drifted from the contract — so feature code only ever catches
 * {@link ApiError}. Responses are parsed with a Zod schema rather than cast, because a `Portfolio`
 * that TypeScript merely *believes* has a `stocks` array is exactly the kind of lie that surfaces
 * as a blank screen in production.
 */

export type QueryValue = string | number | boolean | readonly string[];

export interface RequestOptions<TResponse> {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly query?: Readonly<Record<string, QueryValue | undefined>>;
  readonly body?: unknown;
  /** Omit for endpoints that answer `204 No Content`. */
  readonly schema?: z.ZodType<TResponse>;
  /** Lets a caller cancel; combined with the configured timeout rather than replacing it. */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

function buildUrl(path: string, query?: Readonly<Record<string, QueryValue | undefined>>): string {
  const base = appConfig.api.baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${suffix}`;

  if (query === undefined) {
    return url;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      // The API accepts `?tickers=A,B` and `?tickers=A&tickers=B`; the comma form keeps URLs short
      // and matches the documented example.
      if (value.length > 0) {
        params.append(key, value.join(','));
      }
      continue;
    }

    params.append(key, String(value));
  }

  const queryString = params.toString();

  return queryString === '' ? url : `${url}?${queryString}`;
}

/**
 * One signal that fires when the caller cancels *or* the timeout expires.
 *
 * `AbortSignal.any` does this natively, but it is recent enough that a manual fallback is cheaper
 * than a polyfill; both paths return a `clear` so the timer never outlives the request.
 */
function withTimeout(timeoutMs: number, caller?: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);

  const clear = (): void => {
    clearTimeout(timer);
  };

  if (caller === undefined) {
    return { signal: timeoutController.signal, clear };
  }

  if (caller.aborted) {
    timeoutController.abort(caller.reason);
    return { signal: timeoutController.signal, clear };
  }

  const forward = (): void => {
    timeoutController.abort(caller.reason);
  };

  caller.addEventListener('abort', forward, { once: true });

  return {
    signal: timeoutController.signal,
    clear: () => {
      clear();
      caller.removeEventListener('abort', forward);
    },
  };
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function readBody<TResponse>(response: Response, schema?: z.ZodType<TResponse>): Promise<TResponse> {
  if (schema === undefined) {
    return undefined as TResponse;
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (cause) {
    throw new ApiError('The server returned a response that could not be read.', {
      kind: 'parse',
      status: response.status,
      cause,
    });
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    // Worth a log line with the detail: the user can do nothing about it, but whoever changed the
    // contract needs to see which field moved.
    logger.error('Response did not match the expected schema', {
      url: response.url,
      issues: result.error.issues,
    });

    throw new ApiError('The server returned unexpected data.', {
      kind: 'parse',
      status: response.status,
      cause: result.error,
    });
  }

  return result.data;
}

export async function request<TResponse = void>({
  method = 'GET',
  path,
  query,
  body,
  schema,
  signal,
  timeoutMs = appConfig.api.timeoutMs,
}: RequestOptions<TResponse>): Promise<TResponse> {
  const url = buildUrl(path, query);
  const { signal: combinedSignal, clear } = withTimeout(timeoutMs, signal);

  logger.debug('API request', { method, url });

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combinedSignal,
    });
  } catch (cause) {
    if (isTimeout(cause)) {
      throw new ApiError(`The server did not respond within ${String(timeoutMs / 1000)} seconds.`, {
        kind: 'timeout',
        cause,
      });
    }

    if (isAbort(cause) || signal?.aborted === true) {
      throw new ApiError('The request was cancelled.', { kind: 'aborted', cause });
    }

    throw new ApiError('Could not reach the server. Check your connection and try again.', {
      kind: 'network',
      cause,
    });
  } finally {
    clear();
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return readBody(response, schema);
}
