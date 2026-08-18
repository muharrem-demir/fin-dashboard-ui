import { cn } from '../../../shared/lib/cn';
import { changeDirection, formatPercentChange } from '../../../shared/lib/format';
import { Minus, TrendingDown, TrendingUp } from '../../../shared/ui/icons';

export interface ChangeBadgeProps {
  readonly percentChange: number | undefined;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/**
 * A signed percent change, coloured and with a direction icon.
 *
 * The icon is not decoration: colour alone would leave the sign of a move inaccessible to a
 * red/green colour-blind reader, and the arrow plus the explicit `+`/`-` carry the same information
 * two more ways.
 */
export function ChangeBadge({ percentChange, size = 'md', className }: ChangeBadgeProps): React.JSX.Element {
  const direction = changeDirection(percentChange);

  const tone =
    direction === 'up'
      ? 'bg-gain-500/10 text-gain-600 dark:text-gain-400'
      : direction === 'down'
        ? 'bg-loss-500/10 text-loss-600 dark:text-loss-400'
        : 'bg-surface-sunken text-content-muted';

  const icon =
    direction === 'up' ? (
      <TrendingUp className="size-3.5" />
    ) : direction === 'down' ? (
      <TrendingDown className="size-3.5" />
    ) : (
      <Minus className="size-3.5" />
    );

  return (
    <span
      className={cn(
        'numeric inline-flex items-center gap-1 rounded-md font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        tone,
        className,
      )}
      // Screen readers get words rather than a glyph and a sign.
      aria-label={
        direction === 'unknown'
          ? 'Change unavailable'
          : `${direction === 'up' ? 'Up' : direction === 'down' ? 'Down' : 'Unchanged'} ${formatPercentChange(percentChange)}`
      }
    >
      <span aria-hidden="true">{icon}</span>
      <span aria-hidden="true">{formatPercentChange(percentChange)}</span>
    </span>
  );
}
