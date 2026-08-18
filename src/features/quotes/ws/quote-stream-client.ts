import { logger } from '../../../shared/lib/logger';

import { parseServerMessage, type ClientCommand, type ServerMessage } from './stream-messages';

/**
 * A reconnecting WebSocket client for the quote feed.
 *
 * Deliberately framework-free — no React, no hooks — for two reasons. The connection lifecycle is
 * genuinely imperative (open, subscribe, reconnect, close) and reads far better as a small state
 * machine than as a chain of effects; and being plain TypeScript it can be tested against a fake
 * `WebSocket` with no renderer in the picture.
 *
 * Three behaviours are worth calling out:
 *
 *   - **The watchlist is client state, not connection state.** `subscribe` records what the caller
 *     wants and sends it if the socket is open; on reconnect the recorded list is re-sent
 *     automatically. A caller therefore never has to sequence "wait for open, then subscribe".
 *   - **Reconnect backs off exponentially with jitter** and stops after the configured attempts.
 *     Jitter matters because a dashboard open in several tabs would otherwise reconnect in lockstep
 *     and hit the server as a thundering herd.
 *   - **`close()` is final.** It is what a page unmount calls, so it must not race with a pending
 *     reconnect timer and resurrect the socket a second later.
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Order-sensitive comparison: the caller always passes a sorted list, so order carries no meaning. */
function sameTickers(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((ticker, index) => ticker === right[index]);
}

export interface QuoteStreamHandlers {
  readonly onMessage: (message: ServerMessage) => void;
  readonly onStatusChange?: (status: ConnectionStatus) => void;
  /** Reported for transport failures only; protocol-level `error` frames arrive via `onMessage`. */
  readonly onTransportError?: (reason: string) => void;
}

export interface ReconnectOptions {
  readonly enabled: boolean;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly maxAttempts: number;
}

export interface QuoteStreamOptions extends QuoteStreamHandlers {
  readonly url: string;
  readonly reconnect: ReconnectOptions;
  /** Injectable for tests; defaults to the platform `WebSocket`. */
  readonly socketFactory?: (url: string) => WebSocket;
}

/**
 * Turns a configured URL into an absolute WebSocket URL.
 *
 * The config keeps `/ws/quotes` relative so one value works behind the dev proxy, behind nginx, and
 * behind TLS. Resolving it here — rather than asking deployments to spell out `wss://host/ws/quotes`
 * — is what makes an https deployment work without a config change.
 */
export function resolveSocketUrl(configured: string, origin: string = window.location.origin): string {
  if (/^wss?:\/\//i.test(configured)) {
    return configured;
  }

  if (/^https?:\/\//i.test(configured)) {
    return configured.replace(/^http/i, 'ws');
  }

  const base = new URL(origin);
  const scheme = base.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = configured.startsWith('/') ? configured : `/${configured}`;

  return `${scheme}//${base.host}${path}`;
}

export class QuoteStreamClient {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'idle';
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** What the caller wants to watch, independent of whether a socket is currently open. */
  private desiredTickers: readonly string[] = [];
  /**
   * What the *current* socket has been told to watch.
   *
   * Reset on every open, which is what makes reconnection re-send the watchlist while a repeated
   * `subscribe` with an unchanged list sends nothing. The consumer hook re-runs its subscribe effect
   * on each status change, so without this the server would receive the same frame twice per connect.
   */
  private sentTickers: readonly string[] | null = null;
  private disposed = false;

  private readonly url: string;
  private readonly reconnectOptions: ReconnectOptions;
  private readonly createSocket: (url: string) => WebSocket;
  private readonly handlers: QuoteStreamHandlers;

  constructor(options: QuoteStreamOptions) {
    this.url = options.url;
    this.reconnectOptions = options.reconnect;
    this.createSocket = options.socketFactory ?? ((url) => new WebSocket(url));
    this.handlers = options;
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  get isOpen(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  get watchedTickers(): readonly string[] {
    return this.desiredTickers;
  }

  connect(): void {
    if (this.disposed || this.socket !== null) {
      return;
    }

    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let socket: WebSocket;

    try {
      socket = this.createSocket(this.url);
    } catch (cause) {
      // A malformed URL throws synchronously and never fires `onerror`, so it has to be caught here
      // or the client would sit in `connecting` forever.
      logger.error('Could not open the quote stream', cause);
      this.handlers.onTransportError?.('The live price feed could not be opened.');
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      // A connection that succeeded starts the backoff budget over: the next outage is a new outage,
      // not a continuation of the one that has just been recovered from.
      this.attempt = 0;
      this.sentTickers = null;
      this.setStatus('open');
      logger.debug('Quote stream open', { url: this.url });
      this.flushSubscription();
    };

    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const message = parseServerMessage(event.data);

      if (message === null) {
        logger.warn('Ignoring unrecognised quote stream frame', event.data);
        return;
      }

      this.handlers.onMessage(message);
    };

    socket.onerror = () => {
      // The browser deliberately withholds the reason from script; `onclose` follows and carries
      // whatever detail there is, so the useful work happens there.
      logger.debug('Quote stream reported a transport error');
    };

    socket.onclose = (event: CloseEvent) => {
      this.socket = null;

      if (this.disposed) {
        this.setStatus('closed');
        return;
      }

      logger.debug('Quote stream closed', { code: event.code, reason: event.reason });
      this.scheduleReconnect();
    };
  }

  /**
   * Sets the watchlist.
   *
   * Records the list unconditionally and sends it only if the socket is open — the requirement that
   * subscriptions happen "if the connection is open" is satisfied without the caller checking,
   * because anything recorded while the socket is down is re-sent on the next open.
   */
  subscribe(tickers: readonly string[]): void {
    this.desiredTickers = [...tickers];
    this.flushSubscription();
  }

  /** Drops the watchlist and tells the server to stop, keeping the connection open. */
  unsubscribe(): void {
    this.desiredTickers = [];
    this.sentTickers = [];
    this.send({ action: 'unsubscribe' });
  }

  /**
   * Closes the connection for good and cancels any pending reconnect.
   *
   * Idempotent, because React may unmount a component whose socket never finished opening.
   */
  close(): void {
    this.disposed = true;
    this.clearReconnectTimer();

    const socket = this.socket;
    this.socket = null;

    if (socket !== null) {
      // Detach first: the handlers close over `this`, and a late frame arriving during teardown
      // would otherwise push state into an unmounted consumer.
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Client navigated away');
      }
    }

    this.desiredTickers = [];
    this.setStatus('closed');
  }

  private flushSubscription(): void {
    if (!this.isOpen) {
      return;
    }

    const alreadySent = this.sentTickers;

    if (alreadySent !== null && sameTickers(alreadySent, this.desiredTickers)) {
      return;
    }

    if (this.desiredTickers.length === 0) {
      // Nothing to watch. A brand-new connection is already watching nothing, so only an actual
      // change needs a frame — and "watch nothing" must be expressed as `unsubscribe`, because the
      // server rejects an empty ticker list as a client error.
      if (alreadySent === null || alreadySent.length === 0) {
        this.sentTickers = [];
        return;
      }

      this.sentTickers = [];
      this.send({ action: 'unsubscribe' });
      return;
    }

    this.sentTickers = this.desiredTickers;
    this.send({ action: 'subscribe', tickers: this.desiredTickers });
  }

  private send(command: ClientCommand): void {
    if (!this.isOpen || this.socket === null) {
      return;
    }

    try {
      this.socket.send(JSON.stringify(command));
      logger.debug('Quote stream command sent', command);
    } catch (cause) {
      logger.warn('Could not send a quote stream command', cause);
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || !this.reconnectOptions.enabled) {
      this.setStatus('closed');
      return;
    }

    if (this.attempt >= this.reconnectOptions.maxAttempts) {
      logger.warn('Giving up on the quote stream', { attempts: this.attempt });
      this.setStatus('closed');
      this.handlers.onTransportError?.('Live prices are offline. Reload the page to try reconnecting.');
      return;
    }

    this.attempt += 1;
    this.setStatus('reconnecting');

    const backoff = Math.min(
      this.reconnectOptions.initialDelayMs * 2 ** (this.attempt - 1),
      this.reconnectOptions.maxDelayMs,
    );
    // Up to 30% jitter, so multiple tabs do not reconnect in lockstep.
    const delay = Math.round(backoff * (1 + Math.random() * 0.3));

    logger.debug('Reconnecting to the quote stream', { attempt: this.attempt, delay });

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.handlers.onStatusChange?.(status);
  }
}
