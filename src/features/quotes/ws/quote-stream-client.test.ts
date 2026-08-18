import { FakeWebSocket, installFakeWebSocket } from '../../../test/fake-websocket';
import { aQuoteTick } from '../../../test/factories';

import { QuoteStreamClient, resolveSocketUrl, type ConnectionStatus } from './quote-stream-client';
import type { ServerMessage } from './stream-messages';

/**
 * The WebSocket client's contract, driven through a fake socket.
 *
 * The subscription rules are the interesting part: the requirements say to subscribe "if the connection
 * is open", and the design answer is that the client records intent and reconciles it with the socket's
 * state. These tests pin that down from both directions — subscribing before the socket opens, and the
 * watchlist surviving a reconnect.
 */
describe('QuoteStreamClient', () => {
  let restore: () => void;
  let messages: ServerMessage[];
  let statuses: ConnectionStatus[];

  const noReconnect = { enabled: false, initialDelayMs: 10, maxDelayMs: 20, maxAttempts: 0 };

  function createClient(reconnect = noReconnect): QuoteStreamClient {
    return new QuoteStreamClient({
      url: 'ws://api.test/ws/quotes',
      reconnect,
      onMessage: (message) => messages.push(message),
      onStatusChange: (status) => statuses.push(status),
      socketFactory: (url) => new FakeWebSocket(url) as unknown as WebSocket,
    });
  }

  beforeEach(() => {
    restore = installFakeWebSocket();
    messages = [];
    statuses = [];
  });

  afterEach(() => {
    restore();
    jest.useRealTimers();
  });

  it('reports open once the handshake completes', () => {
    const client = createClient();
    client.connect();

    expect(statuses).toEqual(['connecting']);

    FakeWebSocket.latest.open();

    expect(statuses).toEqual(['connecting', 'open']);
    expect(client.isOpen).toBe(true);
  });

  it('sends the watchlist recorded before the socket opened', () => {
    const client = createClient();
    client.connect();

    // The page knows its holdings before the socket finishes connecting; nothing may be lost.
    client.subscribe(['AAPL', 'MSFT']);
    expect(FakeWebSocket.latest.sent).toHaveLength(0);

    FakeWebSocket.latest.open();

    expect(FakeWebSocket.latest.sentCommands).toEqual([{ action: 'subscribe', tickers: ['AAPL', 'MSFT'] }]);
  });

  it('replaces the watchlist when stocks are added or removed', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    client.subscribe(['AAPL']);
    client.subscribe(['AAPL', 'TSLA']);
    client.subscribe(['TSLA']);

    expect(FakeWebSocket.latest.sentCommands).toEqual([
      { action: 'subscribe', tickers: ['AAPL'] },
      { action: 'subscribe', tickers: ['AAPL', 'TSLA'] },
      { action: 'subscribe', tickers: ['TSLA'] },
    ]);
  });

  it('unsubscribes rather than sending an empty ticker list, which the server rejects', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    client.subscribe(['AAPL']);
    client.subscribe([]);

    expect(FakeWebSocket.latest.sentCommands).toEqual([
      { action: 'subscribe', tickers: ['AAPL'] },
      { action: 'unsubscribe' },
    ]);
  });

  it('parses quote ticks and hands them to the consumer', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    FakeWebSocket.latest.emit(aQuoteTick());

    expect(messages).toHaveLength(1);
    expect(messages[0]?.type).toBe('quotes');
  });

  it('passes through the connected greeting with the server-declared interval', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    FakeWebSocket.latest.emit({ type: 'connected', subscriberId: '3f8c1a2b', intervalMillis: 3000 });

    expect(messages[0]).toEqual({ type: 'connected', subscriberId: '3f8c1a2b', intervalMillis: 3000 });
  });

  it.each([
    ['malformed JSON', 'not json at all'],
    ['an unknown frame type', { type: 'something-new', payload: 1 }],
    ['a frame missing required fields', { type: 'quotes' }],
  ])('ignores %s without disturbing the connection', (_label, frame) => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    FakeWebSocket.latest.emit(frame);

    expect(messages).toHaveLength(0);
    expect(client.isOpen).toBe(true);
  });

  it('surfaces protocol error frames as messages, not as transport failures', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    FakeWebSocket.latest.emit({ type: 'unavailable', message: 'provider down', timestamp: '2026-08-18T09:00:00Z' });

    expect(messages[0]?.type).toBe('unavailable');
    // Neither `error` nor `unavailable` closes the connection, so neither should trigger a reconnect.
    expect(client.isOpen).toBe(true);
  });

  it('closes the socket and stops watching anything', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();
    client.subscribe(['AAPL']);

    const socket = FakeWebSocket.latest;
    client.close();

    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    expect(socket.closeCode).toBe(1000);
    expect(client.watchedTickers).toEqual([]);
    expect(statuses.at(-1)).toBe('closed');
  });

  it('survives close() being called twice, as an unmount race can do', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    client.close();

    expect(() => {
      client.close();
    }).not.toThrow();
  });

  it('drops frames that arrive after close() rather than pushing into an unmounted consumer', () => {
    const client = createClient();
    client.connect();
    FakeWebSocket.latest.open();

    const socket = FakeWebSocket.latest;
    client.close();
    socket.emit(aQuoteTick());

    expect(messages).toHaveLength(0);
  });

  describe('reconnection', () => {
    const withReconnect = { enabled: true, initialDelayMs: 100, maxDelayMs: 400, maxAttempts: 3 };

    it('re-sends the watchlist on the new connection', () => {
      jest.useFakeTimers();

      const client = createClient(withReconnect);
      client.connect();
      FakeWebSocket.latest.open();
      client.subscribe(['AAPL', 'MSFT']);

      FakeWebSocket.latest.serverClose();
      jest.runOnlyPendingTimers();

      // A second socket, and the watchlist restored without the caller re-subscribing.
      expect(FakeWebSocket.instances).toHaveLength(2);
      FakeWebSocket.latest.open();
      expect(FakeWebSocket.latest.sentCommands).toEqual([{ action: 'subscribe', tickers: ['AAPL', 'MSFT'] }]);
    });

    it('gives up after the configured number of consecutive failures', () => {
      jest.useFakeTimers();
      const failures: string[] = [];

      const client = new QuoteStreamClient({
        url: 'ws://api.test/ws/quotes',
        reconnect: { enabled: true, initialDelayMs: 10, maxDelayMs: 20, maxAttempts: 2 },
        onMessage: () => undefined,
        onStatusChange: (status) => statuses.push(status),
        onTransportError: (reason) => failures.push(reason),
        socketFactory: (url) => new FakeWebSocket(url) as unknown as WebSocket,
      });

      client.connect();

      // Never opened: each socket dies during the handshake, so the attempts are consecutive.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        FakeWebSocket.latest.serverClose();
        jest.runOnlyPendingTimers();
      }

      // Original plus two retries, and then it stops rather than retrying forever.
      expect(FakeWebSocket.instances).toHaveLength(3);
      expect(statuses.at(-1)).toBe('closed');
      expect(failures.at(-1)).toContain('Live prices are offline');
    });

    it('starts the attempt budget over after a connection that succeeded', () => {
      jest.useFakeTimers();

      const client = createClient({ enabled: true, initialDelayMs: 10, maxDelayMs: 20, maxAttempts: 1 });
      client.connect();

      // Each outage is recovered from, so a single-attempt budget is never exhausted — an all-day
      // dashboard must not stop reconnecting because of a blip that happened an hour ago.
      for (let outage = 0; outage < 3; outage += 1) {
        FakeWebSocket.latest.open();
        FakeWebSocket.latest.serverClose();
        jest.runOnlyPendingTimers();
      }

      expect(FakeWebSocket.instances).toHaveLength(4);
      expect(client.connectionStatus).toBe('reconnecting');
    });

    it('sends no redundant frame when the watchlist has not changed', () => {
      const client = createClient();
      client.connect();
      FakeWebSocket.latest.open();

      client.subscribe(['AAPL']);
      client.subscribe(['AAPL']);

      // The consumer hook re-runs its subscribe effect on every status change; the server should not
      // be told the same thing twice.
      expect(FakeWebSocket.latest.sentCommands).toEqual([{ action: 'subscribe', tickers: ['AAPL'] }]);
    });

    it('sends no frame at all on a fresh connection with nothing to watch', () => {
      const client = createClient();
      client.connect();
      FakeWebSocket.latest.open();

      // A new socket is already watching nothing; an unsubscribe here would be pure noise.
      expect(FakeWebSocket.latest.sent).toEqual([]);
    });

    it('does not reconnect after close(), even if a timer was already pending', () => {
      jest.useFakeTimers();

      const client = createClient(withReconnect);
      client.connect();
      FakeWebSocket.latest.open();
      FakeWebSocket.latest.serverClose();

      client.close();
      jest.runOnlyPendingTimers();

      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('stays closed when reconnection is disabled', () => {
      jest.useFakeTimers();

      const client = createClient();
      client.connect();
      FakeWebSocket.latest.open();
      FakeWebSocket.latest.serverClose();
      jest.runOnlyPendingTimers();

      expect(FakeWebSocket.instances).toHaveLength(1);
      expect(client.connectionStatus).toBe('closed');
    });
  });
});

describe('resolveSocketUrl', () => {
  it.each([
    ['/ws/quotes', 'http://localhost:5173', 'ws://localhost:5173/ws/quotes'],
    ['/ws/quotes', 'https://dashboard.example.com', 'wss://dashboard.example.com/ws/quotes'],
    ['ws/quotes', 'http://localhost:5173', 'ws://localhost:5173/ws/quotes'],
    // Already absolute: passed through, and http upgraded to ws.
    ['ws://api.test/ws/quotes', 'https://ignored.example', 'ws://api.test/ws/quotes'],
    ['wss://api.test/ws/quotes', 'http://ignored.example', 'wss://api.test/ws/quotes'],
    ['https://api.test/ws/quotes', 'http://ignored.example', 'wss://api.test/ws/quotes'],
  ])('resolves %p against %p to %p', (configured, origin, expected) => {
    expect(resolveSocketUrl(configured, origin)).toBe(expected);
  });

  it('preserves a non-default port', () => {
    expect(resolveSocketUrl('/ws/quotes', 'http://localhost:8080')).toBe('ws://localhost:8080/ws/quotes');
  });
});
