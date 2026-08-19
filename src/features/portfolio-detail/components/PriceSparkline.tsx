import { cn } from '../../../shared/lib/cn';
import type { PricePoint } from '../../quotes/api/quote-schemas';
import { chartGeometry, summarizeHistory } from '../lib/price-history';

/**
 * The size of the cell chart, in CSS pixels.
 *
 * The height is the table's own line height — `text-sm` resolves to 20px — so the history column adds
 * a graphic to a row without adding a single pixel to it. Changing this number changes the height of
 * every row in the table, which is why it is a named constant and not a utility class.
 */
export const SPARKLINE_WIDTH = 64;
export const SPARKLINE_HEIGHT = 20;

const STROKE_WIDTH = 1.5;

export interface PriceSparklineProps {
  readonly points: readonly PricePoint[];
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
}

/**
 * A line, and nothing else.
 *
 * No axes, no labels, no tooltip: at 64×20 there is room for a shape and the shape is the whole
 * message — did this position drift up or down over the window. The numbers live one click away, in
 * the full chart.
 *
 * Presentational and `aria-hidden`, because it is always rendered inside a control that carries the
 * accessible name. A screen reader hearing "AAPL price history, up 2.4% over 5 trading days" has more
 * than this drawing can give it.
 */
export function PriceSparkline({
  points,
  width = SPARKLINE_WIDTH,
  height = SPARKLINE_HEIGHT,
  className,
}: PriceSparklineProps): React.JSX.Element | null {
  // Half the stroke, or the flattest series is drawn with its top half outside the box.
  const geometry = chartGeometry(points, { width, height, paddingX: 1, paddingY: STROKE_WIDTH / 2 });
  const summary = summarizeHistory(points);

  if (geometry === null || summary === null) {
    return null;
  }

  const tone =
    summary.trend === 'up'
      ? 'text-gain-600 dark:text-gain-400'
      : summary.trend === 'down'
        ? 'text-loss-600 dark:text-loss-400'
        : 'text-content-muted';

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width}
      height={height}
      className={cn('overflow-visible', tone, className)}
    >
      {/* `currentColor` at a low alpha rather than a second token: the tint is the line's own colour,
          so the two can never drift apart when the trend flips. */}
      <path d={geometry.area} fill="currentColor" fillOpacity={0.12} stroke="none" />
      <path
        d={geometry.line}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
