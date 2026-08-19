import { useState, type FormEvent } from 'react';

import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { TextField } from '../../../shared/ui/TextField';
import { WATCH_TICKER_MAX_LENGTH } from '../api/watchlist-schemas';
import { validateWatchTicker } from '../lib/watch-validation';

export interface AddWatchDialogProps {
  readonly onClose: () => void;
  readonly onSubmit: (ticker: string) => void;
  readonly submitting: boolean;
}

/**
 * Asks for a symbol and nothing else.
 *
 * Mounted only while it is open, so the field starts empty on every open without an effect resetting
 * it. The value is upper-cased as it is typed rather than on submit: the API stores upper case either
 * way, and showing the user what will be stored beats silently changing it afterwards.
 */
export function AddWatchDialog({ onClose, onSubmit, submitting }: AddWatchDialogProps): React.JSX.Element {
  const [ticker, setTicker] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const problem = validateWatchTicker(ticker);

    if (problem !== undefined) {
      setError(problem);
      return;
    }

    setError(undefined);
    onSubmit(ticker.trim().toUpperCase());
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add watch"
      description="Follow a symbol's price without holding it in a portfolio."
      dismissible={!submitting}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Ticker symbol"
          placeholder="e.g. AAPL"
          value={ticker}
          maxLength={WATCH_TICKER_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={submitting}
          error={error}
          hint="Case does not matter — symbols are stored in upper case."
          className="numeric uppercase"
          onChange={(event) => {
            setTicker(event.target.value.toUpperCase());
            setError(undefined);
          }}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Add watch
          </Button>
        </div>
      </form>
    </Modal>
  );
}
