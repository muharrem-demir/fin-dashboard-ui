import { isApiError, toUserMessage } from '../api/api-error';
import { cn } from '../lib/cn';

import { Button } from './Button';
import { CircleAlert, RefreshCw } from './icons';

export interface ErrorStateProps {
  readonly error: unknown;
  readonly title?: string;
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  readonly className?: string;
}

/**
 * The failed-to-load panel for a whole region.
 *
 * Retry is only offered when it could plausibly work: re-requesting a portfolio that returned 404
 * will return 404 again, and a button that is guaranteed to fail is worse than no button.
 */
export function ErrorState({
  error,
  title = 'Could not load this data',
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps): React.JSX.Element {
  const showRetry = onRetry !== undefined && (!isApiError(error) || error.isRetryable);

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 px-6 py-16 text-center', className)}>
      <div
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-loss-500/10 text-loss-600 dark:text-loss-400"
      >
        <CircleAlert className="size-7" />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-base font-semibold text-content-primary">{title}</p>
        <p className="max-w-md text-sm text-content-secondary">{toUserMessage(error)}</p>
      </div>

      {showRetry && (
        <Button variant="secondary" onClick={onRetry} loading={retrying} icon={<RefreshCw className="size-4" />}>
          Try again
        </Button>
      )}
    </div>
  );
}
