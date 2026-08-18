import { cn } from '../../../shared/lib/cn';
import { formatCount, formatCurrency, formatShares } from '../../../shared/lib/format';

import { ChangeBadge } from './ChangeBadge';

export interface PortfolioStatsProps {
  readonly stockCount: number;
  readonly totalShares: number;
  readonly totalValue: number;
  readonly valueIsComplete: boolean;
  readonly pricedCount: number;
  readonly dayChangePercent: number | undefined;
}

interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
  readonly children?: React.ReactNode;
  readonly emphasis?: boolean;
}

function Stat({ label, value, note, children, emphasis = false }: StatProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <dt className="text-xs font-medium tracking-wide text-content-muted uppercase">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-2">
        <span
          className={cn('numeric font-semibold text-content-primary', emphasis ? 'text-2xl sm:text-3xl' : 'text-xl')}
        >
          {value}
        </span>
        {children}
      </dd>
      {note !== undefined && <p className="text-xs text-content-muted">{note}</p>}
    </div>
  );
}

/**
 * The headline figures above the holdings table.
 *
 * Market value is marked as partial when some positions have no price yet, rather than quietly
 * presenting a sum of the subset as the portfolio's value. On a financial dashboard an
 * understated total that looks authoritative is worse than an obviously incomplete one.
 */
export function PortfolioStats({
  stockCount,
  totalShares,
  totalValue,
  valueIsComplete,
  pricedCount,
  dayChangePercent,
}: PortfolioStatsProps): React.JSX.Element {
  const hasAnyPrice = pricedCount > 0;

  return (
    <dl className="grid grid-cols-2 divide-border-subtle border-b border-border-subtle sm:grid-cols-4 sm:divide-x">
      <Stat
        label="Market value"
        value={hasAnyPrice ? formatCurrency(totalValue) : '—'}
        note={
          !hasAnyPrice
            ? 'Waiting for prices'
            : valueIsComplete
              ? undefined
              : `Partial — ${formatCount(pricedCount)} of ${formatCount(stockCount)} priced`
        }
        emphasis
      />

      <Stat label="Day change" value="" note={hasAnyPrice ? 'Value-weighted' : undefined}>
        <ChangeBadge percentChange={dayChangePercent} />
      </Stat>

      <Stat label="Stocks" value={formatCount(stockCount)} />

      <Stat label="Total shares" value={formatShares(totalShares)} />
    </dl>
  );
}
