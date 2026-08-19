import { formatCurrency, formatFullDate } from '../../../shared/lib/format';
import { Modal } from '../../../shared/ui/Modal';
import type { PriceHistory } from '../../quotes/api/quote-schemas';
import { summarizeHistory } from '../lib/price-history';

import { ChangeBadge } from './ChangeBadge';
import { PriceHistoryChart } from './PriceHistoryChart';

export interface PriceHistoryDialogProps {
  readonly history: PriceHistory;
  readonly onClose: () => void;
}

interface StatProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

function Stat({ label, children }: StatProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-content-muted uppercase">{label}</span>
      <span className="numeric text-sm font-semibold text-content-primary">{children}</span>
    </div>
  );
}

/**
 * The full-size view of one holding's price history.
 *
 * Titled with the ticker and nothing else, because the ticker is what the user clicked and the dialog
 * has to answer "which row is this" before it answers anything else.
 *
 * Dismissal — clicking the backdrop, pressing Escape, the close button — is all {@link Modal}'s, and it
 * is always dismissible: this reads data and starts no request, so there is nothing here that could be
 * left half-done by closing it.
 *
 * Mounted only while open, like the other dialogs in this app, so there is no stale ticker to reset and
 * no chart geometry computed for a dialog nobody is looking at.
 */
export function PriceHistoryDialog({ history, onClose }: PriceHistoryDialogProps): React.JSX.Element {
  const summary = summarizeHistory(history.points);
  const first = history.points[0];
  const last = history.points[history.points.length - 1];

  const range =
    first === undefined || last === undefined
      ? undefined
      : `${formatFullDate(first.date)} – ${formatFullDate(last.date)}`;

  return (
    <Modal open onClose={onClose} title={history.ticker} description={range} className="max-w-2xl">
      <div className="flex flex-col gap-5">
        <PriceHistoryChart ticker={history.ticker} points={history.points} />

        {summary !== null && (
          <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-4 sm:grid-cols-4">
            <Stat label="Latest close">{formatCurrency(summary.last)}</Stat>
            <Stat label="Period change">
              {/* The same badge the table uses, so "up 2.4%" looks and reads identically wherever it
                  appears — including its arrow, which is what carries direction without colour. */}
              <ChangeBadge percentChange={summary.changePercent} size="sm" />
            </Stat>
            <Stat label="High">{formatCurrency(summary.max)}</Stat>
            <Stat label="Low">{formatCurrency(summary.min)}</Stat>
          </div>
        )}

        <p className="text-xs text-content-muted">
          {`Closing prices for the last ${String(history.points.length)} trading ${history.points.length === 1 ? 'day' : 'days'}. History is loaded once when the page opens and does not follow the live feed.`}
        </p>
      </div>
    </Modal>
  );
}
