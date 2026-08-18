import { z } from 'zod';

import { stockQuoteSchema } from '../api/quote-schemas';

/**
 * The WebSocket protocol, as a discriminated union.
 *
 * Every frame the server can send is parsed into one of these, so the consumer switches on `type`
 * with the compiler checking that no case was forgotten. Anything unrecognised is dropped with a log
 * line rather than thrown — a server that grows a new frame type must not break an older client that
 * was perfectly happy without it.
 */

const connectedSchema = z.object({
  type: z.literal('connected'),
  subscriberId: z.string(),
  intervalMillis: z.number(),
});

const subscriptionSchema = z.object({
  type: z.union([z.literal('subscribed'), z.literal('unsubscribed')]),
  tickers: z.array(z.string()),
});

/**
 * One tick of quotes.
 *
 * `shares` is not part of the backend's quote today, but the field is accepted here so a server that
 * begins pushing position changes on the same channel needs no client change to be honoured — see
 * `applyQuoteTick` in `../../portfolio-detail/lib/holdings.ts`, which updates shares whenever a tick
 * carries them.
 */
const quoteTickSchema = z.object({
  type: z.literal('quotes'),
  timestamp: z.string(),
  quotes: z.array(stockQuoteSchema.extend({ shares: z.number().int().optional() })),
  unresolved: z.array(z.string()),
  quoteCount: z.number().int(),
});

/**
 * `error` is the client's own mistake — a bad symbol, an unknown action — and leaves the existing
 * subscription intact. `unavailable` is the quote provider failing, the streaming counterpart of a
 * 502; the next tick is the retry. Neither closes the connection, so neither should trigger a
 * reconnect.
 */
const streamErrorSchema = z.object({
  type: z.union([z.literal('error'), z.literal('unavailable')]),
  message: z.string(),
  timestamp: z.string(),
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  connectedSchema,
  subscriptionSchema,
  quoteTickSchema,
  streamErrorSchema,
]);

export type ConnectedMessage = z.infer<typeof connectedSchema>;
export type SubscriptionMessage = z.infer<typeof subscriptionSchema>;
export type QuoteTickMessage = z.infer<typeof quoteTickSchema>;
export type StreamErrorMessage = z.infer<typeof streamErrorSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type LiveQuote = QuoteTickMessage['quotes'][number];

/** The only two things a client may say. `subscribe` replaces the whole watchlist. */
export type ClientCommand =
  { readonly action: 'subscribe'; readonly tickers: readonly string[] } | { readonly action: 'unsubscribe' };

export function parseServerMessage(raw: string): ServerMessage | null {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = serverMessageSchema.safeParse(payload);

  return result.success ? result.data : null;
}
