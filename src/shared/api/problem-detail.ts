import { z } from 'zod';

import { ApiError, type FieldError } from './api-error';

/**
 * The backend reports every failure as an RFC 9457 problem document, so the client only has to
 * understand one error shape.
 *
 * The schema is loose on purpose. A gateway timing out in front of the API returns HTML, and a
 * proxy may return its own JSON; neither is a reason to throw a *second* error while handling the
 * first. Anything unparseable falls back to the status line.
 */
const problemDetailSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export type ProblemDetail = z.infer<typeof problemDetailSchema>;

/** Human-readable fallbacks for the statuses this API actually returns. */
const STATUS_FALLBACKS: Readonly<Record<number, string>> = {
  400: 'The request was rejected as invalid.',
  404: 'The requested item no longer exists.',
  409: 'That conflicts with the current state of the data.',
  422: 'The request could not be processed.',
  500: 'The server ran into an unexpected problem.',
  502: 'Market data is temporarily unavailable.',
  503: 'The service is temporarily unavailable.',
  504: 'The server took too long to respond.',
};

function fallbackMessage(status: number, statusText: string): string {
  return (
    STATUS_FALLBACKS[status] ??
    (statusText.trim() !== '' ? statusText : `Request failed with status ${String(status)}.`)
  );
}

/**
 * Picks the sentence a user should read.
 *
 * `detail` is the specific one ("Portfolio 3f8c… was not found") and `title` the generic one
 * ("Portfolio not found"), so `detail` is preferred. Validation problems are the exception: their
 * detail is the useless "One or more fields are invalid.", while the field messages underneath say
 * exactly what to fix.
 */
function messageFor(problem: ProblemDetail, status: number, statusText: string): string {
  const fieldErrors = problem.errors ?? [];

  if (fieldErrors.length > 0) {
    return fieldErrors.map((error) => `${error.field}: ${error.message}`).join(', ');
  }

  const detail = problem.detail?.trim();

  if (detail !== undefined && detail !== '') {
    return detail;
  }

  const title = problem.title?.trim();

  if (title !== undefined && title !== '') {
    return title;
  }

  return fallbackMessage(status, statusText);
}

/** Reads a non-2xx response and turns it into an {@link ApiError}. Never throws. */
export async function toApiError(response: Response): Promise<ApiError> {
  let parsed: ProblemDetail = {};

  try {
    const body: unknown = await response.json();
    const result = problemDetailSchema.safeParse(body);

    if (result.success) {
      parsed = result.data;
    }
  } catch {
    // Empty body, HTML from a proxy, or malformed JSON. The status alone still tells the story.
  }

  const fieldErrors: readonly FieldError[] = parsed.errors ?? [];

  return new ApiError(messageFor(parsed, response.status, response.statusText), {
    kind: 'http',
    status: response.status,
    title: parsed.title,
    detail: parsed.detail,
    type: parsed.type,
    instance: parsed.instance,
    fieldErrors,
  });
}
