/**
 * Number and money formatting for the holdings table.
 *
 * `Intl` formatters are cached because the table re-renders on every WebSocket tick — constructing
 * one per cell per tick is measurable once a portfolio holds a few dozen positions.
 */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const percent = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

/** The em dash every "we do not know this yet" cell shows, so absence looks deliberate. */
export const NOT_AVAILABLE = '—';

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatCurrency(value: number | null | undefined): string {
  return isFiniteNumber(value) ? currency.format(value) : NOT_AVAILABLE;
}

/** For headline figures, where `$1.2M` reads better than `$1,234,567.00`. */
export function formatCompactCurrency(value: number | null | undefined): string {
  return isFiniteNumber(value) ? compactCurrency.format(value) : NOT_AVAILABLE;
}

export function formatShares(value: number | null | undefined): string {
  return isFiniteNumber(value) ? integer.format(value) : NOT_AVAILABLE;
}

export function formatCount(value: number | null | undefined): string {
  return isFiniteNumber(value) ? integer.format(value) : NOT_AVAILABLE;
}

/** Always signed, because the sign is the point: `+1.18%`, `-1.00%`, `0.00%`. */
export function formatPercentChange(value: number | null | undefined): string {
  return isFiniteNumber(value) ? `${percent.format(value)}%` : NOT_AVAILABLE;
}

/**
 * Calendar dates from the API — `LocalDate`, so no time and no zone.
 *
 * Pinned to UTC on purpose. `new Date('2026-08-14')` is midnight UTC, and formatting that in a
 * timezone west of Greenwich renders "Aug 13": a chart of daily closes would be labelled a day out
 * for most of the Americas. Fixing the formatter's zone to the one the value was written in keeps
 * the label saying what the backend said.
 */
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const fullDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): Date | undefined {
  const match = ISO_DATE.exec(value);

  if (match === null) {
    return undefined;
  }

  const [, year, month, day] = match;

  if (year === undefined || month === undefined || day === undefined) {
    return undefined;
  }

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `2026-08-14` as `Aug 14`. For axis labels, where the year is the same on every tick. */
export function formatShortDate(value: string): string {
  const date = parseIsoDate(value);

  return date === undefined ? NOT_AVAILABLE : shortDate.format(date);
}

/** `2026-08-14` as `Aug 14, 2026`. For a single date read on its own, where the year matters. */
export function formatFullDate(value: string): string {
  const date = parseIsoDate(value);

  return date === undefined ? NOT_AVAILABLE : fullDate.format(date);
}

export type ChangeDirection = 'up' | 'down' | 'flat' | 'unknown';

/**
 * Classifies a percent change so colour and iconography can be decided in one place.
 *
 * `unknown` is distinct from `flat`: the API omits `percentChange` when the previous close is
 * unknown, and painting that grey-neutral rather than green-zero avoids implying the price held
 * steady when in truth nobody knows.
 */
export function changeDirection(value: number | null | undefined): ChangeDirection {
  if (!isFiniteNumber(value)) {
    return 'unknown';
  }

  if (value > 0) {
    return 'up';
  }

  if (value < 0) {
    return 'down';
  }

  return 'flat';
}

export function formatRelativeTime(from: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - from.getTime()) / 1000);

  if (seconds < 5) {
    return 'just now';
  }

  if (seconds < 60) {
    return `${String(seconds)}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${String(minutes)}m ago`;
  }

  return `${String(Math.floor(minutes / 60))}h ago`;
}
