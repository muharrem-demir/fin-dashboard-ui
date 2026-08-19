import { aPriceHistory, aPricePoint, aQuotesResponse } from '../../../test/factories';

import {
  chartGeometry,
  indexHistories,
  isChartable,
  labelIndices,
  priceTicks,
  summarizeHistory,
} from './price-history';

/** A rising, evenly spaced series: the easiest one to reason about by hand. */
const points = [
  aPricePoint({ date: '2026-08-10', close: 100 }),
  aPricePoint({ date: '2026-08-11', close: 110 }),
  aPricePoint({ date: '2026-08-12', close: 120 }),
];

describe('isChartable', () => {
  it.each([
    ['no history at all', undefined, false],
    ['an empty series', aPriceHistory({ points: [] }), false],
    ['a single close', aPriceHistory({ points: [aPricePoint()] }), false],
    ['two closes', aPriceHistory({ closes: [1, 2] }), true],
  ])('treats %s as chartable=%p', (_label, history, expected) => {
    expect(isChartable(history)).toBe(expected);
  });
});

describe('chartGeometry', () => {
  it('returns null for a series too short to draw a line through', () => {
    expect(chartGeometry([], { width: 100, height: 20 })).toBeNull();
    expect(chartGeometry([aPricePoint()], { width: 100, height: 20 })).toBeNull();
  });

  it('spreads the points evenly across the width, inside the padding', () => {
    const geometry = chartGeometry(points, { width: 100, height: 20, paddingX: 10 });

    expect(geometry?.points.map((point) => point.x)).toEqual([10, 50, 90]);
  });

  it('inverts the y axis, so the highest close sits at the top', () => {
    const geometry = chartGeometry(points, { width: 100, height: 20 });

    // SVG grows downward; a rising price must therefore produce falling y values.
    expect(geometry?.points.map((point) => point.y)).toEqual([20, 10, 0]);
    expect(geometry?.min).toBe(100);
    expect(geometry?.max).toBe(120);
  });

  it('keeps the stroke inside the box when padding is given for it', () => {
    const geometry = chartGeometry(points, { width: 100, height: 20, paddingY: 2 });

    expect(geometry?.points.map((point) => point.y)).toEqual([18, 10, 2]);
  });

  it('centres a flat series instead of dividing by a zero range', () => {
    const flat = [aPricePoint({ date: '2026-08-10', close: 50 }), aPricePoint({ date: '2026-08-11', close: 50 })];

    const geometry = chartGeometry(flat, { width: 100, height: 20 });

    expect(geometry?.points.map((point) => point.y)).toEqual([10, 10]);
    expect(geometry?.line).not.toContain('NaN');
  });

  it('draws the line as a move followed by one line segment per point', () => {
    expect(chartGeometry(points, { width: 100, height: 20 })?.line).toBe('M0 20 L50 10 L100 0');
  });

  it('closes the area down to the baseline so the tint has a bottom edge', () => {
    const geometry = chartGeometry(points, { width: 100, height: 20 });

    expect(geometry?.area).toBe('M0 20 L50 10 L100 0 L100 20 L0 20 Z');
    expect(geometry?.baselineY).toBe(20);
  });

  it('places a price with the same arithmetic that placed the points', () => {
    const geometry = chartGeometry(points, { width: 100, height: 20, paddingY: 2 });

    // A gridline at 110 has to land exactly on the 110 marker, or the chart labels a line it misses.
    expect(geometry?.yFor(110)).toBe(geometry?.points[1]?.y);
    expect(geometry?.yFor(120)).toBe(2);
  });
});

describe('summarizeHistory', () => {
  it('reports the ends, the extremes and the direction of the window', () => {
    expect(summarizeHistory(points)).toEqual({
      first: 100,
      last: 120,
      min: 100,
      max: 120,
      trend: 'up',
      changePercent: 20,
    });
  });

  it.each([
    ['up', [100, 120], 'up'],
    ['down', [120, 100], 'down'],
    ['sideways', [100, 100], 'flat'],
  ])('calls a %s window %p', (_label, closes, trend) => {
    const series = (closes as readonly number[]).map((close, index) =>
      aPricePoint({ date: `2026-08-1${String(index)}`, close }),
    );

    expect(summarizeHistory(series)?.trend).toBe(trend);
  });

  it('leaves the change unanswered when the window opened at zero', () => {
    // The same rule the backend applies to the daily change: a percentage of nothing is not 0%.
    const series = [aPricePoint({ close: 0 }), aPricePoint({ date: '2026-08-11', close: 10 })];

    expect(summarizeHistory(series)?.changePercent).toBeUndefined();
  });

  it('returns null for an empty series', () => {
    expect(summarizeHistory([])).toBeNull();
  });
});

describe('priceTicks', () => {
  it('spreads the requested number of values across the range, highest first', () => {
    expect(priceTicks(100, 120, 5)).toEqual([120, 115, 110, 105, 100]);
  });

  it('collapses a flat range to one value rather than five identical labels', () => {
    expect(priceTicks(50, 50, 5)).toEqual([50]);
  });
});

describe('labelIndices', () => {
  it.each([
    [0, 6, []],
    [3, 6, [0, 1, 2]],
    [5, 5, [0, 1, 2, 3, 4]],
    [11, 6, [0, 2, 4, 6, 8, 10]],
  ])('picks labels for %p points capped at %p', (length, limit, expected) => {
    expect(labelIndices(length, limit)).toEqual(expected);
  });

  it('always anchors the axis at both ends', () => {
    const indices = labelIndices(37, 6);

    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBe(36);
    expect(indices.length).toBeLessThanOrEqual(6);
  });
});

describe('indexHistories', () => {
  it('keys histories by upper-cased ticker, so a lower-cased position still finds one', () => {
    const batch = aQuotesResponse({ history: [aPriceHistory({ ticker: 'aapl' })] });

    expect(indexHistories(batch).AAPL?.ticker).toBe('aapl');
  });

  it.each([
    ['no response yet', undefined],
    ['a response that was not asked for history', aQuotesResponse()],
    ['a response whose provider had none', aQuotesResponse({ history: [] })],
  ])('answers with an empty index for %s', (_label, batch) => {
    expect(indexHistories(batch)).toEqual({});
  });
});
