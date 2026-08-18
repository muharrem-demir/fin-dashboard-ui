import { useEffect, useRef, useState } from 'react';

import { appConfig } from '../../../config/app-config';
import { logger } from '../../../shared/lib/logger';

import { QuoteStreamClient, resolveSocketUrl, type ConnectionStatus } from './quote-stream-client';
import type { QuoteTickMessage, ServerMessage, StreamErrorMessage } from './stream-messages';

export interface UseQuoteStreamOptions {
  /** Symbols to watch. Sent on open and re-sent whenever this list changes. */
  readonly tickers: readonly string[];
  /** Set false to keep the socket closed — e.g. while the portfolio is still loading. */
  readonly enabled?: boolean;
  readonly onTick: (tick: QuoteTickMessage) => void;
  /** A protocol-level `error` or `unavailable` frame; the connection stays open. */
  readonly onStreamError?: (message: StreamErrorMessage) => void;
  /** The transport failed, or reconnection was abandoned. */
  readonly onTransportError?: (reason: string) => void;
}

export interface QuoteStreamState {
  readonly status: ConnectionStatus;
  readonly isLive: boolean;
  /** How often the server said it will push, from the `connected` frame. */
  readonly intervalMillis: number | null;
}

/**
 * Binds the quote feed to a component's lifetime.
 *
 * The subtlety this hook exists to contain is that a WebSocket lives longer than a render but shorter
 * than a page, and neither of those is what `useEffect` dependencies naturally express. So:
 *
 *   - The client is created and connected by an effect that depends only on `enabled`, which means a
 *     changing watchlist never tears down and rebuilds a working socket.
 *   - Callbacks are held in a ref and read through it, so a parent re-rendering with a fresh
 *     `onTick` closure does not reconnect the socket either.
 *   - The watchlist is pushed by a separate effect keyed on the *contents* of `tickers` rather than
 *     its identity, because `portfolio.stocks.map(...)` is a new array on every render.
 *
 * Unmount closes the socket, which is what satisfies the requirement that leaving the detail page
 * ends the connection.
 */
export function useQuoteStream({
  tickers,
  enabled = true,
  onTick,
  onStreamError,
  onTransportError,
}: UseQuoteStreamOptions): QuoteStreamState {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [intervalMillis, setIntervalMillis] = useState<number | null>(null);

  const clientRef = useRef<QuoteStreamClient | null>(null);
  const callbacks = useRef({ onTick, onStreamError, onTransportError });

  // Refreshed after every render so the socket's handlers always reach the latest closures without the
  // socket itself depending on them. Assigned in an effect rather than during render, because a ref
  // written while rendering is not guaranteed to survive a discarded render pass.
  useEffect(() => {
    callbacks.current = { onTick, onStreamError, onTransportError };
  }, [onTick, onStreamError, onTransportError]);

  // Identity-independent dependency for the subscription effect below.
  const tickerKey = [...tickers]
    .map((ticker) => ticker.toUpperCase())
    .sort()
    .join(',');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const client = new QuoteStreamClient({
      url: resolveSocketUrl(appConfig.websocket.url),
      reconnect: appConfig.websocket.reconnect,
      onStatusChange: setStatus,
      onTransportError: (reason) => {
        callbacks.current.onTransportError?.(reason);
      },
      onMessage: (message: ServerMessage) => {
        switch (message.type) {
          case 'connected':
            setIntervalMillis(message.intervalMillis);
            logger.debug('Quote stream ready', { subscriberId: message.subscriberId });
            break;

          case 'quotes':
            callbacks.current.onTick(message);
            break;

          case 'error':
          case 'unavailable':
            callbacks.current.onStreamError?.(message);
            break;

          case 'subscribed':
          case 'unsubscribed':
            logger.debug(`Quote stream ${message.type}`, message.tickers);
            break;
        }
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.close();
      clientRef.current = null;
      setStatus('closed');
      setIntervalMillis(null);
    };
  }, [enabled]);

  // Push the watchlist whenever it changes. The client records it either way and re-sends on the next
  // open, so this is correct even if the socket is still connecting.
  useEffect(() => {
    const client = clientRef.current;

    if (client === null) {
      return;
    }

    const next = tickerKey === '' ? [] : tickerKey.split(',');
    client.subscribe(next);
  }, [tickerKey, status]);

  return {
    status,
    isLive: status === 'open',
    intervalMillis,
  };
}
