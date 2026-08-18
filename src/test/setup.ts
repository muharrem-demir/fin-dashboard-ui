import '@testing-library/jest-dom';

/**
 * Global test environment setup.
 *
 * Everything here exists because jsdom lacks a browser API the app legitimately uses. The
 * implementations are deliberately minimal and honest — a fake that behaves differently from the real
 * thing is worse than no fake, because tests then pass on behaviour the browser will not reproduce.
 */

// jsdom does not implement matchMedia at all, and ThemeProvider calls it on mount. Defaults to "not
// dark", so the light theme is the baseline unless a test says otherwise.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// Present in jsdom 22+ but not in every environment the suite may run in, and only ever used for
// scroll animations the tests do not assert on.
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: class {
      observe(): void {
        /* no-op */
      }
      unobserve(): void {
        /* no-op */
      }
      disconnect(): void {
        /* no-op */
      }
    },
  });
}

/**
 * jsdom has no WebSocket. The constant values are defined here so that production code comparing
 * `readyState === WebSocket.OPEN` behaves the same under test; individual tests install their own
 * fake instance via `installFakeWebSocket` in `./fake-websocket.ts`.
 */
if (!('WebSocket' in globalThis)) {
  Object.defineProperty(globalThis, 'WebSocket', {
    writable: true,
    value: class {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
    },
  });
}

// A quiet console keeps a failing assertion visible. React's act() warnings and the logger's own
// output are both silenced; anything a test genuinely needs to assert on, it spies on itself.
beforeEach(() => {
  jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
