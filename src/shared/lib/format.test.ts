import {
  NOT_AVAILABLE,
  changeDirection,
  formatCompactCurrency,
  formatCount,
  formatCurrency,
  formatFullDate,
  formatPercentChange,
  formatRelativeTime,
  formatShares,
  formatShortDate,
} from './format';

describe('formatCurrency', () => {
  it.each([
    [0, '$0.00'],
    [150.25, '$150.25'],
    [2253.75, '$2,253.75'],
    [-42.5, '-$42.50'],
    // Two decimals always, so a column of prices lines up.
    [150.2, '$150.20'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatCurrency(input)).toBe(expected);
  });

  it.each([undefined, null, NaN, Infinity])('renders %p as the unavailable marker', (input) => {
    expect(formatCurrency(input)).toBe(NOT_AVAILABLE);
  });
});

describe('formatPercentChange', () => {
  it.each([
    [1.18, '+1.18%'],
    [-1, '-1.00%'],
    // Explicitly signed, except at zero — the sign is the information.
    [0, '0.00%'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatPercentChange(input)).toBe(expected);
  });

  it('renders an absent change as unavailable rather than as zero', () => {
    // The API omits percentChange when the previous close is unknown; 0.00% would be a lie.
    expect(formatPercentChange(undefined)).toBe(NOT_AVAILABLE);
  });
});

describe('changeDirection', () => {
  it.each([
    [1.5, 'up'],
    [-1.5, 'down'],
    [0, 'flat'],
    [undefined, 'unknown'],
  ] as const)('classifies %p as %p', (input, expected) => {
    expect(changeDirection(input)).toBe(expected);
  });
});

describe('formatShares and formatCount', () => {
  it('groups thousands and shows no decimals', () => {
    expect(formatShares(1234567)).toBe('1,234,567');
    expect(formatCount(35)).toBe('35');
  });
});

describe('formatCompactCurrency', () => {
  it('abbreviates large figures', () => {
    expect(formatCompactCurrency(1234567)).toBe('$1.2M');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-18T12:00:00Z');

  it.each([
    [0, 'just now'],
    [3, 'just now'],
    [30, '30s ago'],
    [90, '1m ago'],
    [3600, '1h ago'],
  ])('describes %p seconds ago as %p', (secondsAgo, expected) => {
    expect(formatRelativeTime(new Date(now.getTime() - secondsAgo * 1000), now)).toBe(expected);
  });
});

describe('formatShortDate and formatFullDate', () => {
  it.each([
    ['2026-08-14', 'Aug 14', 'Aug 14, 2026'],
    ['2026-01-01', 'Jan 1', 'Jan 1, 2026'],
    ['2025-12-31', 'Dec 31', 'Dec 31, 2025'],
  ])('formats %p as %p and %p', (input, short, full) => {
    expect(formatShortDate(input)).toBe(short);
    expect(formatFullDate(input)).toBe(full);
  });

  it('reads the date in the zone it was written in, not the local one', () => {
    // A LocalDate has no zone. Formatting it locally would render midnight UTC on the 1st as the
    // previous day for anyone west of Greenwich, and label a whole chart a day out.
    expect(formatShortDate('2026-03-01')).toBe('Mar 1');
  });

  it.each(['', 'yesterday', '2026-8-4', '2026-08-14T00:00:00Z'])(
    'renders %p as the unavailable marker rather than an Invalid Date',
    (input) => {
      expect(formatShortDate(input)).toBe(NOT_AVAILABLE);
      expect(formatFullDate(input)).toBe(NOT_AVAILABLE);
    },
  );
});
