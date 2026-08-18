import { useState, type FormEvent } from 'react';

import { Button } from '../../../shared/ui/Button';
import { Plus } from '../../../shared/ui/icons';
import { TextField } from '../../../shared/ui/TextField';
import { TICKER_MAX_LENGTH } from '../../portfolios/api/portfolio-schemas';
import { validateAddStock, type AddStockErrors } from '../lib/add-stock-validation';

export interface AddStockFormProps {
  readonly onSubmit: (ticker: string, shares: number) => void;
  readonly submitting: boolean;
  /** Reached the backend's 50-symbol subscription cap. */
  readonly disabled?: boolean;
}

export function AddStockForm({ onSubmit, submitting, disabled = false }: AddStockFormProps): React.JSX.Element {
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [errors, setErrors] = useState<AddStockErrors>({});

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const found = validateAddStock(ticker, shares);

    if (found.ticker !== undefined || found.shares !== undefined) {
      setErrors(found);
      return;
    }

    setErrors({});
    onSubmit(ticker.trim().toUpperCase(), Number(shares.trim()));
    setTicker('');
    setShares('');
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 sm:flex-row sm:items-start" noValidate>
      <TextField
        label="Ticker"
        placeholder="AAPL"
        value={ticker}
        // Upper-cased as the user types: the API normalises anyway, and seeing it happen makes the
        // case-insensitivity obvious instead of surprising.
        onChange={(event) => {
          setTicker(event.target.value.toUpperCase());
          setErrors((current) => ({ ...current, ticker: undefined }));
        }}
        maxLength={TICKER_MAX_LENGTH}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        disabled={submitting || disabled}
        error={errors.ticker}
        containerClassName="sm:flex-1"
      />

      <TextField
        label="Shares"
        placeholder="10"
        value={shares}
        onChange={(event) => {
          setShares(event.target.value);
          setErrors((current) => ({ ...current, shares: undefined }));
        }}
        // `inputMode` gives phones a numeric keypad; `type="text"` keeps the spinner off and lets the
        // validation above own the rules.
        inputMode="numeric"
        autoComplete="off"
        disabled={submitting || disabled}
        error={errors.shares}
        containerClassName="sm:w-32"
      />

      <Button
        type="submit"
        icon={<Plus className="size-4" />}
        loading={submitting}
        disabled={disabled}
        // Aligns with the inputs rather than their labels.
        className="sm:mt-[1.6rem]"
      >
        Add stock
      </Button>
    </form>
  );
}
