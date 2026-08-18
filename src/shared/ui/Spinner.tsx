import { cn } from '../lib/cn';

export interface SpinnerProps {
  readonly className?: string;
  readonly label?: string;
}

/**
 * An indeterminate progress indicator.
 *
 * `currentColor` on the visible arc means it inherits from whatever it sits inside, so the same
 * component works on a primary button and on a muted background without a variant prop.
 */
export function Spinner({ className, label = 'Loading' }: SpinnerProps): React.JSX.Element {
  return (
    <svg
      className={cn('size-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
