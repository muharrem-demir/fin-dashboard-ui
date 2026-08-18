/**
 * A controllable `WebSocket` stand-in.
 *
 * Tests drive the connection explicitly — `open()`, `emit()`, `serverClose()` — instead of waiting on
 * timers, which is what makes the reconnect and subscription tests deterministic rather than flaky.
 * Every frame the client sends is recorded in {@link sent}, so a test can assert on the protocol
 * rather than on internal state.
 */
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  /** Every socket the code under test constructed, oldest first — reconnects append. */
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  closeCode: number | null = null;

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(payload: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new Error('Cannot send on a socket that is not open.');
    }

    this.sent.push(payload);
  }

  close(code = 1000): void {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return;
    }

    this.readyState = FakeWebSocket.CLOSED;
    this.closeCode = code;
  }

  // ---- Test controls ---------------------------------------------------------------------------

  /** Completes the handshake. */
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  /** Delivers a server frame. Objects are JSON-encoded; strings are passed through verbatim so a
   *  test can send deliberately malformed input. */
  emit(message: unknown): void {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }

  /** The server or network dropping the connection, as distinct from the client closing it. */
  serverClose(code = 1006, reason = 'abnormal closure'): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  fail(): void {
    this.onerror?.();
  }

  /** Everything the client sent, parsed. */
  get sentCommands(): unknown[] {
    return this.sent.map((payload): unknown => JSON.parse(payload));
  }

  static reset(): void {
    FakeWebSocket.instances = [];
  }

  static get latest(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1);

    if (socket === undefined) {
      throw new Error('No FakeWebSocket has been constructed yet.');
    }

    return socket;
  }
}

/**
 * Installs {@link FakeWebSocket} as the global `WebSocket` and returns a restore function.
 *
 * Needed because `quote-stream-client.ts` compares against `WebSocket.OPEN` on the global, not on the
 * injected factory's return value.
 */
export function installFakeWebSocket(): () => void {
  const original = Reflect.get(globalThis, 'WebSocket') as unknown;

  FakeWebSocket.reset();
  Object.defineProperty(globalThis, 'WebSocket', { writable: true, configurable: true, value: FakeWebSocket });

  return () => {
    Object.defineProperty(globalThis, 'WebSocket', { writable: true, configurable: true, value: original });
    FakeWebSocket.reset();
  };
}
