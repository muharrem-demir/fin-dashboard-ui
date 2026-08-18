import { useEffect, useState } from 'react';

import { cn } from '../../../shared/lib/cn';
import { formatRelativeTime } from '../../../shared/lib/format';
import { Wifi, WifiOff } from '../../../shared/ui/icons';
import type { ConnectionStatus } from '../../quotes/ws/quote-stream-client';

export interface ConnectionBadgeProps {
  readonly status: ConnectionStatus;
  readonly lastTickAt: number | null;
}

const LABELS: Readonly<Record<ConnectionStatus, string>> = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  open: 'Live',
  reconnecting: 'Reconnecting…',
  closed: 'Offline',
};

/**
 * The health of the live feed, with the age of the last tick.
 *
 * Worth the screen space: when prices stop moving, "is the market quiet or is my connection dead?" is
 * the first question a user has, and a dashboard that cannot answer it is not trustworthy. The
 * timestamp re-renders on a 5-second interval only while a tick has actually been seen, so an idle
 * page schedules no work.
 */
export function ConnectionBadge({ status, lastTickAt }: ConnectionBadgeProps): React.JSX.Element {
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (lastTickAt === null) {
      return;
    }

    const timer = setInterval(() => {
      forceRender((count) => count + 1);
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [lastTickAt]);

  const isLive = status === 'open';
  const isTrying = status === 'connecting' || status === 'reconnecting';

  return (
    <span
      // `status` rather than a live region: the label changes on reconnect, and announcing every
      // transition would talk over the user.
      role="status"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium',
        isLive
          ? 'border-gain-500/30 bg-gain-500/10 text-gain-600 dark:text-gain-400'
          : isTrying
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'border-border-strong bg-surface-sunken text-content-muted',
      )}
    >
      <span aria-hidden="true" className="relative flex size-2">
        {isLive && <span className="absolute inline-flex size-full animate-ping rounded-full bg-gain-500 opacity-70" />}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            isLive ? 'bg-gain-500' : isTrying ? 'bg-amber-500' : 'bg-content-muted',
          )}
        />
      </span>

      <span aria-hidden="true">{isLive ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}</span>

      <span>{LABELS[status]}</span>

      {lastTickAt !== null && <span className="text-content-muted">· {formatRelativeTime(new Date(lastTickAt))}</span>}
    </span>
  );
}
