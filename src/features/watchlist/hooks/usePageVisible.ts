import { useSyncExternalStore } from 'react';

/**
 * Whether this page is currently on screen.
 *
 * `useSyncExternalStore` rather than `useState` plus an effect, because that is precisely what this
 * is: an external store — `document.visibilityState` — that React should read directly and subscribe
 * to. Mirroring it into state would need a `setState` inside an effect, and would still be wrong for
 * one render after a tab switch.
 *
 * The server snapshot answers `true`, since anything rendered without a document has no hidden tab to
 * be behind.
 */

function subscribe(onStoreChange: () => void): () => void {
  document.addEventListener('visibilitychange', onStoreChange);

  return () => {
    document.removeEventListener('visibilitychange', onStoreChange);
  };
}

function getSnapshot(): boolean {
  return document.visibilityState === 'visible';
}

function getServerSnapshot(): boolean {
  return true;
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
