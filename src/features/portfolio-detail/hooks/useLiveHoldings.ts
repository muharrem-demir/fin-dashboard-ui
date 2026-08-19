import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQuotesBatch } from '../../quotes/api/quote-queries';
import { useQuoteStream } from '../../quotes/ws/useQuoteStream';
import type { ConnectionStatus } from '../../quotes/ws/quote-stream-client';
import type { QuoteTickMessage, StreamErrorMessage } from '../../quotes/ws/stream-messages';
import type { Stock } from '../../portfolios/api/portfolio-schemas';
import { useToast } from '../../../shared/ui/toast/useToast';
import { isApiError, toUserMessage } from '../../../shared/api/api-error';

import {
  applyQuoteTick,
  buildHoldings,
  emptyLiveQuoteState,
  normalizeTicker,
  portfolioValue,
  weightedPercentChange,
  type Holding,
  type LiveQuoteState,
} from '../lib/holdings';

export interface LiveHoldings {
  readonly holdings: readonly Holding[];
  readonly totalValue: number;
  readonly valueIsComplete: boolean;
  readonly pricedCount: number;
  readonly dayChangePercent: number | undefined;
  readonly connectionStatus: ConnectionStatus;
  readonly isLive: boolean;
  readonly lastTickAt: number | null;
  /** True while the opening batch request is in flight. */
  readonly quotesLoading: boolean;
  /** Non-null when the opening batch failed; the stream may still deliver prices. */
  readonly quotesError: unknown;
  readonly retryQuotes: () => void;
}

/**
 * Everything the detail page needs to render live rows, in one hook.
 *
 * The data flows from two sources by design. The REST batch is asked for the moment the holdings arrive,
 * because a table of em dashes waiting three seconds for the first tick looks broken; the WebSocket then
 * keeps those numbers moving.
 *
 * The two are merged at render time rather than folded into a single store: the batch stays in React
 * Query's cache and only the live layer is component state. That keeps one copy of every price, and means
 * the only `setState` here happens in the socket's message callback — where React actually wants it — with
 * no effect synchronising one cache into another.
 */
export function useLiveHoldings(stocks: readonly Stock[] | undefined): LiveHoldings {
  const toast = useToast();
  const [live, setLive] = useState<LiveQuoteState>(emptyLiveQuoteState);

  // Sorted and de-duplicated so the value is stable across renders — it keys the batch query and the
  // stream subscription, both of which would otherwise re-fire on every render.
  const tickers = useMemo(() => {
    const unique = new Set((stocks ?? []).map((stock) => normalizeTicker(stock.ticker)));
    return [...unique].sort();
  }, [stocks]);

  // History rides along on the opening batch rather than on a request of its own: it is the same
  // endpoint, and asking twice would re-fetch every quote just to collect the closes beside it. Nothing
  // refreshes it afterwards — the feed carries no history — so it is fetched once, when the page opens.
  const batch = useQuotesBatch(tickers, { includeHistory: true });

  const onTick = useCallback((tick: QuoteTickMessage) => {
    // The server's own timestamp is preferred over the arrival time, so the "age of data" reading is not
    // flattered by a slow client. `Date.parse` answers NaN for a malformed value, which would poison every
    // comparison downstream, so it is checked rather than coerced.
    const serverTime = Date.parse(tick.timestamp);
    const receivedAt = Number.isNaN(serverTime) ? Date.now() : serverTime;

    // A message from an external system: exactly the place a `setState` belongs.
    setLive((current) => applyQuoteTick(current, tick, receivedAt));
  }, []);

  // `unavailable` frames repeat every tick while the provider is down, so they are left to the connection
  // badge rather than toasted — a toast every three seconds would bury everything else. A client-side
  // `error` frame is a one-off and worth surfacing.
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
    // No socket until there is something to watch: the backend fetches nothing while nobody is subscribed,
    // and an idle connection for an empty portfolio would be pure overhead.
    enabled: tickers.length > 0,
    onTick,
    onStreamError,
    onTransportError,
  });

  // One toast for a failed opening batch, not one per retry. A 502 here is expected against the live Yahoo
  // provider, so it is phrased as "prices unavailable" rather than as an app failure.
  const reportedBatchError = useRef<unknown>(null);

  useEffect(() => {
    const error: unknown = batch.error;

    if (error === null || error === undefined || reportedBatchError.current === error) {
      return;
    }

    reportedBatchError.current = error;

    toast.error(
      isApiError(error) && error.isUpstreamUnavailable ? 'Market data is unavailable' : 'Could not load prices',
      { description: toUserMessage(error) },
    );
  }, [batch.error, toast]);

  const holdings = useMemo(
    () => buildHoldings({ stocks: stocks ?? [], batch: batch.data, live }),
    [stocks, batch.data, live],
  );

  const value = useMemo(() => portfolioValue(holdings), [holdings]);
  const dayChangePercent = useMemo(() => weightedPercentChange(holdings), [holdings]);

  const retryQuotes = useCallback(() => {
    reportedBatchError.current = null;
    void batch.refetch();
  }, [batch]);

  return {
    holdings,
    totalValue: value.total,
    valueIsComplete: value.complete,
    pricedCount: value.pricedCount,
    dayChangePercent,
    connectionStatus: stream.status,
    isLive: stream.isLive,
    lastTickAt: live.lastTickAt,
    quotesLoading: batch.isPending && tickers.length > 0,
    quotesError: batch.error,
    retryQuotes,
  };
}
