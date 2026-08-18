import { useState, type FormEvent } from 'react';

import { Button } from '../../../shared/ui/Button';
import { Trash2 } from '../../../shared/ui/icons';
import { TextField } from '../../../shared/ui/TextField';
import { TICKER_MAX_LENGTH } from '../../portfolios/api/portfolio-schemas';
import { normalizeTicker } from '../lib/holdings';

export interface RemoveStockFormProps {
  /** Called only for a ticker the portfolio actually holds; the caller then confirms. */
  readonly onFound: (ticker: string) => void;
  /** Called for a ticker that is not held, so the caller can raise an error toast. */
  readonly onMissing: (ticker: string) => void;
  readonly heldTickers: readonly string[];
  readonly submitting: boolean;
}

/**
 * Removal by typing a symbol.
 *
 * The lookup happens here, before any request: a ticker the portfolio does not hold is reported to the
 * caller as missing rather than sent to the API, which is both what the requirement asks for and the
 * kinder behaviour — a confirmation dialog for a holding that does not exist would be nonsense, and a
 * 404 toast is a worse way to say "you typed FOO, you hold AAPL".
 *
 * The bin icon on each table row is the fast path; this form exists for keyboard-driven use and for
 * long portfolios where scrolling to a row is the slow way round.
 */
export function RemoveStockForm({
  onFound,
  onMissing,
  heldTickers,
  submitting,
}: RemoveStockFormProps): React.JSX.Element {
  const [ticker, setTicker] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const symbol = normalizeTicker(ticker);

    if (symbol === '') {
      setError('Enter the ticker you want to remove.');
      return;
    }

    setError(undefined);

    if (heldTickers.some((held) => normalizeTicker(held) === symbol)) {
      onFound(symbol);
      setTicker('');
      return;
    }

    onMissing(symbol);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 sm:flex-row sm:items-start" noValidate>
      <TextField
        label="Ticker to remove"
        placeholder="AAPL"
        value={ticker}
        onChange={(event) => {
          setTicker(event.target.value.toUpperCase());

          if (error !== undefined) {
            setError(undefined);
          }
        }}
        maxLength={TICKER_MAX_LENGTH}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        disabled={submitting}
        error={error}
        hint="You will be asked to confirm."
        containerClassName="sm:flex-1"
      />

      <Button
        type="submit"
        variant="danger"
        icon={<Trash2 className="size-4" />}
        loading={submitting}
        className="sm:mt-[1.6rem]"
      >
        Remove stock
      </Button>
    </form>
  );
}
