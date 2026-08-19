import type { PriceHistory, PricePoint, StockQuotes } from '../../quotes/api/quote-schemas';

/**
 * Turning a list of closes into the coordinates a chart draws.
 *
 * Pure and free of React, for the same reason the price merge is: the arithmetic that maps a price
 * range onto a box is easy to get subtly wrong — an inverted axis, a series that is perfectly flat,
 * a chart that clips its own stroke — and none of those are visible in a rendered snapshot. They are
 * visible in a table of cases.
 *
 * The one convention worth stating: SVG's y axis grows downward and a price chart does not, so every
 * y here is `top + height - scaled`. A rising series produces *decreasing* y values.
 */

/** A history point placed in the chart's coordinate space. */
export interface ChartPoint {
  readonly x: number;
  readonly y: number;
  readonly date: string;
  readonly close: number;
}

/** The box a series is drawn into, in SVG user units. */
export interface ChartBox {
  readonly width: number;
  readonly height: number;
  /** Inset from the left and right edges. Keeps the first and last markers off the boundary. */
  readonly paddingX?: number;
  /** Inset from the top and bottom. Must be at least half the stroke width or the line clips. */
  readonly paddingY?: number;
}

export interface ChartGeometry {
  readonly points: readonly ChartPoint[];
  /** The `d` of the line itself. */
  readonly line: string;
  /** The `d` of the same line closed down to the baseline, for the tint underneath it. */
  readonly area: string;
  readonly min: number;
  readonly max: number;
  readonly baselineY: number;
  /**
   * Where a given price sits on the y axis.
   *
   * Exposed so gridlines and axis labels are placed by the same arithmetic that placed the line. Two
   * copies of this formula is exactly how a chart ends up with a `$150` label that does not touch the
   * `$150` point.
   */
  readonly yFor: (close: number) => number;
}

/** Enough of a series to draw a line. One close is a dot, not a trend. */
export const MIN_CHARTABLE_POINTS = 2;

export function isChartable(history: PriceHistory | undefined): history is PriceHistory {
  return history !== undefined && history.points.length >= MIN_CHARTABLE_POINTS;
}

/** SVG coordinates round-tripped through the DOM as text, so they are trimmed to something readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Places every close in the box.
 *
 * Returns `null` rather than an empty geometry for a series too short to draw, so a caller has one
 * thing to check instead of guessing whether an empty path means "no data" or "a bug".
 *
 * A perfectly flat series is centred rather than pinned to the top or bottom: dividing by a zero
 * range would put every point at `NaN`, and clamping it to one edge would read as a crash to the
 * floor when in truth the price did not move at all.
 */
export function chartGeometry(points: readonly PricePoint[], box: ChartBox): ChartGeometry | null {
  if (points.length < MIN_CHARTABLE_POINTS) {
    return null;
  }

  const { width, height, paddingX = 0, paddingY = 0 } = box;

  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min;

  const left = paddingX;
  const top = paddingY;
  const innerWidth = Math.max(0, width - paddingX * 2);
  const innerHeight = Math.max(0, height - paddingY * 2);
  const baselineY = round(top + innerHeight);

  const placed = points.map((point, index) => {
    const ratio = range === 0 ? 0.5 : (point.close - min) / range;

    return {
      x: round(left + (innerWidth * index) / (points.length - 1)),
      y: round(top + innerHeight - innerHeight * ratio),
      date: point.date,
      close: point.close,
    };
  });

  const line = placed
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${String(point.x)} ${String(point.y)}`)
    .join(' ');

  const first = placed[0];
  const last = placed[placed.length - 1];

  // Non-null in practice — the length check above guarantees both — but asserting it is a lint error
  // here, and the fallback costs nothing.
  const area =
    first === undefined || last === undefined
      ? line
      : `${line} L${String(last.x)} ${String(baselineY)} L${String(first.x)} ${String(baselineY)} Z`;

  const yFor = (close: number): number =>
    round(top + innerHeight - innerHeight * (range === 0 ? 0.5 : (close - min) / range));

  return { points: placed, line, area, min, max, baselineY, yFor };
}

/** Which way a series ended up over its whole window: last close against first. */
export type HistoryTrend = 'up' | 'down' | 'flat';

export interface HistorySummary {
  readonly first: number;
  readonly last: number;
  readonly min: number;
  readonly max: number;
  readonly trend: HistoryTrend;
  /**
   * The move across the whole window, as a percentage.
   *
   * `undefined` when the first close was zero — the same rule the backend applies to the daily
   * change, and for the same reason: a percentage of nothing is not zero, it is unanswerable.
   */
  readonly changePercent: number | undefined;
}

export function summarizeHistory(points: readonly PricePoint[]): HistorySummary | null {
  const first = points[0];
  const last = points[points.length - 1];

  if (first === undefined || last === undefined) {
    return null;
  }

  const closes = points.map((point) => point.close);

  return {
    first: first.close,
    last: last.close,
    min: Math.min(...closes),
    max: Math.max(...closes),
    trend: last.close > first.close ? 'up' : last.close < first.close ? 'down' : 'flat',
    changePercent: first.close === 0 ? undefined : ((last.close - first.close) / first.close) * 100,
  };
}

/**
 * Evenly spaced values across a price range, highest first — the order gridlines are read in.
 *
 * A flat range collapses to its single value rather than repeating it `count` times, so a stock that
 * did not move gets one label instead of five identical ones stacked down the axis.
 */
export function priceTicks(min: number, max: number, count = 5): readonly number[] {
  if (min === max || count < 2) {
    return [max];
  }

  const step = (max - min) / (count - 1);

  return Array.from({ length: count }, (_, index) => max - step * index);
}

/**
 * Up to `limit` labels spread across a series, always including the first and the last.
 *
 * Returns indices rather than dates so a caller can reach both the label and its x coordinate. The
 * ends are what anchor a date axis — a chart whose axis starts one point in reads as if the data
 * did too.
 */
export function labelIndices(length: number, limit: number): readonly number[] {
  if (length <= 0) {
    return [];
  }

  if (length <= limit || limit < 2) {
    return Array.from({ length }, (_, index) => index);
  }

  const step = (length - 1) / (limit - 1);
  const indices = Array.from({ length: limit }, (_, index) => Math.round(step * index));

  return [...new Set(indices)];
}

/**
 * Indexes a batch response's histories by ticker.
 *
 * Keyed on the upper-cased symbol like every other lookup in this feature, so a history joins its
 * position whatever case the portfolio stored it in.
 */
export function indexHistories(batch: StockQuotes | undefined): Readonly<Record<string, PriceHistory>> {
  const byTicker: Record<string, PriceHistory> = {};

  for (const history of batch?.history ?? []) {
    byTicker[history.ticker.trim().toUpperCase()] = history;
  }

  return byTicker;
}
