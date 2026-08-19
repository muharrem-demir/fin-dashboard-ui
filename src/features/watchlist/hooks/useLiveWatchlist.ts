import { useCallback, useMemo, useState } from 'react';

import { useToast } from '../../../shared/ui/toast/useToast';
import type { ConnectionStatus } from '../../quotes/ws/quote-stream-client';
import type { QuoteTickMessage, StreamErrorMessage } from '../../quotes/ws/stream-messages';
import { useQuoteStream } from '../../quotes/ws/useQuoteStream';
import type { WatchlistEntry } from '../api/watchlist-schemas';
import {
  applyWatchlistTick,
  buildWatchedItems,
  emptyWatchlistQuoteState,
  watchedTickers,
  type WatchedItem,
  type WatchlistQuoteState,
} from '../lib/watched-quotes';

import { usePageVisible } from './usePageVisible';

export interface LiveWatchlist {
  readonly items: readonly WatchedItem[];
  readonly connectionStatus: ConnectionStatus;
  readonly isLive: boolean;
  readonly lastTickAt: number | null;
}

/**
 * Prices the watchlist from the quote feed, for as long as the page is on screen.
 *
 * Three lifetimes meet here and are kept separate on purpose:
 *
 *   - **The connection** follows the page. It opens while this hook is mounted and the tab is
 *     visible, and closes on either leaving the page or hiding the tab — a backgrounded dashboard has
 *     nothing to show, and an idle subscriber still costs the backend an upstream fetch every tick.
 *   - **The subscription** follows the entries. `useQuoteStream` is keyed on the *contents* of the
 *     ticker list, and `QuoteStreamClient` records what it was asked to watch whether or not a socket
 *     is open yet — which is what makes "subscribe once the entries load" and "subscribe once the
 *     connection is established" the same single code path, in either order. Adding or removing an
 *     entry changes the list and re-sends it, because the protocol replaces the whole watchlist rather
 *     than accepting an incremental add.
 *   - **The prices** are the only local state, folded in by the socket's message callback — an
 *     external system delivering an event, which is where a `setState` belongs.
 */
export function useLiveWatchlist(entries: readonly WatchlistEntry[] | undefined): LiveWatchlist {
  const toast = useToast();
  const [live, setLive] = useState<WatchlistQuoteState>(emptyWatchlistQuoteState);
  const visible = usePageVisible();

  const tickers = useMemo(() => watchedTickers(entries ?? []), [entries]);

  const onTick = useCallback((tick: QuoteTickMessage) => {
    // The server's own timestamp is preferred over the arrival time, so "how old is this" is not
    // flattered by a slow client. `Date.parse` answers NaN for a malformed value, which would poison
    // every comparison downstream, so it is checked rather than coerced.
    const serverTime = Date.parse(tick.timestamp);
    const receivedAt = Number.isNaN(serverTime) ? Date.now() : serverTime;

    setLive((current) => applyWatchlistTick(current, tick, receivedAt));
  }, []);

  // `unavailable` frames repeat every tick while the provider is down, so they are left to the cards —
  // which say "no data" — rather than toasted every three seconds. A client-side `error` frame is a
  // one-off and worth surfacing.
  const onStreamError = useCallback(
    (message: StreamErrorMessage) => {
      if (message.type === 'error') {
        toast.warning('Live feed rejected a subscription', { description: message.message });
      }
    },
    [toast],
  );

  const onTransportError = useCallback(
    (reason: string) => {
      toast.warning('Live prices interrupted', { description: reason });
    },
    [toast],
  );

  const stream = useQuoteStream({
    tickers,
    // Keyed on visibility alone, not on whether there is anything to watch: the requirement is that the
    // page holds a connection while it is on screen, and the client sends no frame for an empty list,
    // so an empty watchlist costs one idle socket and nothing else. It also means the first symbol
    // added is watched immediately rather than after a connect.
    enabled: visible,
    onTick,
    onStreamError,
    onTransportError,
  });

  const items = useMemo(() => buildWatchedItems(entries ?? [], live), [entries, live]);

  return {
    items,
    connectionStatus: stream.status,
    isLive: stream.isLive,
    lastTickAt: live.lastTickAt,
  };
}
