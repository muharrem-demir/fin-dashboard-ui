import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ChevronLeft, ChevronRight } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';

export interface WatchlistScrollerProps {
  /** Names the list for a screen reader; the strip itself is visually labelled by the section header. */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * A single row that scrolls sideways, with an arrow at each end.
 *
 * The arrows appear only in the direction there is something to scroll towards, so a watchlist that
 * fits shows none and one scrolled to its end shows one. That decision needs a measurement, and the
 * measurement is taken from the browser rather than inferred from the item count — how many cards fit
 * depends on the viewport, not on how many there are.
 *
 * The measuring is driven entirely by observers: a `ResizeObserver` on the viewport catches the window
 * changing, the same observer on the track catches cards being added and removed, and a scroll
 * listener catches the user moving. Nothing measures during render or synchronously inside an effect —
 * an observer's first callback fires on its own once layout is known, which is exactly when the answer
 * first exists.
 *
 * The strip is not given a `tabindex`. Every card contains a focusable button, so tabbing through them
 * scrolls the row on its own, and a focus stop on a container that a keyboard user cannot then act on
 * would be one more Tab press for nothing.
 */
export function WatchlistScroller({ label, children }: WatchlistScrollerProps): React.JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const [reach, setReach] = useState({ start: false, end: false });

  useEffect(() => {
    const element = viewport.current;
    const content = track.current;

    if (element === null || content === null) {
      return;
    }

    const measure = (): void => {
      const furthest = element.scrollWidth - element.clientWidth;

      // A pixel of slack at each end: fractional layout means `scrollLeft` rarely lands exactly on 0
      // or on the maximum, and without it an arrow flickers on at the end of every scroll.
      const next = { start: element.scrollLeft > 1, end: element.scrollLeft < furthest - 1 };

      setReach((current) => (current.start === next.start && current.end === next.end ? current : next));
    };

    element.addEventListener('scroll', measure, { passive: true });

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(content);

    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  const scrollBy = useCallback((direction: -1 | 1) => {
    const element = viewport.current;

    if (element === null) {
      return;
    }

    // Just under a full page, so the card at the edge stays visible and the eye keeps its place.
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative">
      <div ref={viewport} className="scrollbar-slim overflow-x-auto p-3">
        <ul ref={track} aria-label={label} className="flex w-max list-none gap-3">
          {children}
        </ul>
      </div>

      {reach.start && (
        <>
          {/* Fades the card the arrow sits over, so it reads as "there is more this way" rather than
              as a button dropped on top of a price. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-20 rounded-l-card bg-linear-to-r from-surface-sunken via-surface-sunken/80 to-transparent"
          />
          <IconButton
            label="Scroll watchlist left"
            icon={<ChevronLeft className="size-6" />}
            variant="secondary"
            className="absolute top-1/2 left-2 size-11 -translate-y-1/2 rounded-full shadow-pop"
            onClick={() => {
              scrollBy(-1);
            }}
          />
        </>
      )}

      {reach.end && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-20 rounded-r-card bg-linear-to-l from-surface-sunken via-surface-sunken/80 to-transparent"
          />
          <IconButton
            label="Scroll watchlist right"
            icon={<ChevronRight className="size-6" />}
            variant="secondary"
            className="absolute top-1/2 right-2 size-11 -translate-y-1/2 rounded-full shadow-pop"
            onClick={() => {
              scrollBy(1);
            }}
          />
        </>
      )}
    </div>
  );
}
