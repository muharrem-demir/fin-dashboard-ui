import JSDOMEnvironment from 'jest-environment-jsdom';
import type { EnvironmentContext, JestEnvironmentConfig } from '@jest/environment';

/**
 * jsdom, plus the web APIs jsdom does not implement but Node does.
 *
 * jsdom deliberately stops at the DOM: it has no `fetch`, no `Response`, no `TextEncoder`, no
 * `WebSocket`. The app uses all of them, and so does React Router, which reaches for `TextEncoder` at
 * import time and fails the whole suite without it.
 *
 * Node 20+ ships spec-compliant implementations of every one, so they are borrowed from the Node realm
 * rather than reimplemented. That matters: a hand-rolled `Response` stub would let a test pass on
 * behaviour a browser does not reproduce, which is worse than having no test at all.
 *
 * Only globals jsdom leaves undefined are copied — jsdom's own `DOMException`, `AbortController` and
 * `URL` stay in place, so `instanceof` checks inside the test realm keep working.
 */

/**
 * The Node globals worth exposing to a browser-flavoured test.
 *
 * `MessageChannel` is deliberately absent. React's scheduler prefers it when present and its port
 * keeps Node's event loop alive after the tests finish, which shows up as "a worker process has failed
 * to exit gracefully"; without it the scheduler falls back to `setTimeout`, which behaves identically
 * for our purposes and leaves no handle behind. Nothing in the app uses it directly.
 */
const BORROWED_GLOBALS = [
  'TextEncoder',
  'TextDecoder',
  'fetch',
  'Response',
  'Request',
  'Headers',
  'FormData',
  'Blob',
  'File',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'CompressionStream',
  'DecompressionStream',
  'structuredClone',
  'WebSocket',
  'crypto',
] as const;

export default class BrowserLikeEnvironment extends JSDOMEnvironment {
  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);

    for (const name of BORROWED_GLOBALS) {
      const inJsdom = Reflect.get(this.global, name) as unknown;
      const inNode = Reflect.get(globalThis, name) as unknown;

      if (inJsdom === undefined && inNode !== undefined) {
        Object.defineProperty(this.global, name, {
          value: inNode,
          writable: true,
          configurable: true,
        });
      }
    }
  }
}
