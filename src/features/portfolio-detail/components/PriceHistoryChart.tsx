import { cn } from '../../../shared/lib/cn';
import { formatCurrency, formatFullDate, formatShortDate } from '../../../shared/lib/format';
import type { PricePoint } from '../../quotes/api/quote-schemas';
import { chartGeometry, labelIndices, priceTicks, summarizeHistory } from '../lib/price-history';

/**
 * The chart's own coordinate space.
 *
 * Fixed user units with a `viewBox`, so the SVG scales to whatever width the dialog gives it while the
 * type stays proportionate. The left margin is sized for a currency label — `$1,234.56` at 11 units —
 * and the bottom one for a date.
 */
const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 280;
const MARGIN = { top: 14, right: 14, bottom: 34, left: 62 } as const;

const PLOT_WIDTH = VIEW_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = VIEW_HEIGHT - MARGIN.top - MARGIN.bottom;

const GRID_LINES = 5;
const MAX_DATE_LABELS = 6;

/**
 * Above this many closes the markers stop being points and start being a thick line, so they are
 * dropped and the path carries the shape on its own.
 */
const MAX_MARKERS = 40;

export interface PriceHistoryChartProps {
  readonly ticker: string;
  readonly points: readonly PricePoint[];
  readonly className?: string;
}

/**
 * One ticker's closes, with both axes labelled.
 *
 * The drawing is `aria-hidden` and the same numbers are repeated in a visually hidden table below it.
 * That is the honest way to make a chart accessible: an `aria-label` summarising a line ("trending
 * upward") is an editorial claim, whereas the table is the data, readable row by row and reachable by
 * a screen reader's table navigation.
 */
export function PriceHistoryChart({ ticker, points, className }: PriceHistoryChartProps): React.JSX.Element | null {
  const geometry = chartGeometry(points, {
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    paddingX: 8,
    paddingY: 10,
  });
  const summary = summarizeHistory(points);

  if (geometry === null || summary === null) {
    return null;
  }

  const tone =
    summary.trend === 'up'
      ? 'text-gain-600 dark:text-gain-400'
      : summary.trend === 'down'
        ? 'text-loss-600 dark:text-loss-400'
        : 'text-content-secondary';

  const ticks = priceTicks(geometry.min, geometry.max, GRID_LINES);
  const dateLabels = labelIndices(geometry.points.length, MAX_DATE_LABELS);
  const showMarkers = geometry.points.length <= MAX_MARKERS;

  return (
    <div className={className}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`}
        className={cn('h-auto w-full', tone)}
      >
        <g transform={`translate(${String(MARGIN.left)} ${String(MARGIN.top)})`}>
          {ticks.map((price) => {
            const y = geometry.yFor(price);

            return (
              <g key={price}>
                <line
                  x1={0}
                  x2={PLOT_WIDTH}
                  y1={y}
                  y2={y}
                  className="stroke-border-subtle"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <text
                  x={-10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="numeric fill-content-muted"
                  fontSize={11}
                >
                  {formatCurrency(price)}
                </text>
              </g>
            );
          })}

          <line
            x1={0}
            x2={PLOT_WIDTH}
            y1={geometry.baselineY}
            y2={geometry.baselineY}
            className="stroke-border-strong"
            strokeWidth={1}
          />

          <path d={geometry.area} fill="currentColor" fillOpacity={0.12} stroke="none" />
          <path
            d={geometry.line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {showMarkers &&
            geometry.points.map((point) => (
              <circle
                key={point.date}
                cx={point.x}
                cy={point.y}
                r={2.5}
                fill="currentColor"
                className="stroke-surface-raised"
                strokeWidth={1.5}
              />
            ))}

          {dateLabels.map((index) => {
            const point = geometry.points[index];

            if (point === undefined) {
              return null;
            }

            // The end labels are anchored inward so neither runs off the edge of the plot.
            const anchor = index === 0 ? 'start' : index === geometry.points.length - 1 ? 'end' : 'middle';

            return (
              <text
                key={point.date}
                x={point.x}
                y={PLOT_HEIGHT + 20}
                textAnchor={anchor}
                className="fill-content-muted"
                fontSize={11}
              >
                {formatShortDate(point.date)}
              </text>
            );
          })}
        </g>
      </svg>

      <table className="sr-only">
        <caption>{`${ticker} closing price by trading day`}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Closing price</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatFullDate(point.date)}</th>
              <td>{formatCurrency(point.close)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
