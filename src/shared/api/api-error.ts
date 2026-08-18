/**
 * Every failure the API layer can produce, as one type.
 *
 * The UI needs to answer three questions about a failure — is it worth retrying, is it the user's
 * input that was wrong, and what do I put in the toast — and it should not have to sniff at
 * `error instanceof TypeError` to do it. `kind` answers the first, `fieldErrors` the second, and
 * `message` is always safe to show.
 */

export type ApiErrorKind =
  /** The server answered, and the answer was a 4xx/5xx problem document. */
  | 'http'
  /** The request never reached the server: offline, DNS, CORS, connection refused. */
  | 'network'
  /** The request was abandoned after `api.timeoutMs`. */
  | 'timeout'
  /** The request was cancelled deliberately, e.g. by a component unmounting. */
  | 'aborted'
  /** A 2xx response whose body did not match the schema we expect. */
  | 'parse';

/** One invalid field, as the backend's validation problem document reports it. */
export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export interface ApiErrorOptions {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly type?: string;
  readonly instance?: string;
  readonly fieldErrors?: readonly FieldError[];
  readonly cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly type?: string;
  readonly instance?: string;
  readonly fieldErrors: readonly FieldError[];

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status;
    this.title = options.title;
    this.detail = options.detail;
    this.type = options.type;
    this.instance = options.instance;
    this.fieldErrors = options.fieldErrors ?? [];
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidation(): boolean {
    return this.status === 400 || this.fieldErrors.length > 0;
  }

  /**
   * A 502 from this API means the upstream quote provider is down, not that the dashboard is
   * broken — worth saying differently, because the portfolio itself is still perfectly usable.
   */
  get isUpstreamUnavailable(): boolean {
    return this.status === 502 || this.status === 503 || this.status === 504;
  }

  /** Retrying a 4xx just repeats the same mistake; a network blip or a 5xx may well recover. */
  get isRetryable(): boolean {
    if (this.kind === 'network' || this.kind === 'timeout') {
      return true;
    }

    return this.kind === 'http' && this.status !== undefined && this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * The message to show a user for any thrown value.
 *
 * Anything can be thrown in JavaScript, and a toast rendering `[object Object]` is worse than one
 * saying nothing useful, so unknown shapes collapse to a fixed sentence.
 */
export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallback;
}
