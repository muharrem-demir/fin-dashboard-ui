import { useState, type FormEvent } from 'react';

import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { TextField } from '../../../shared/ui/TextField';
import { PORTFOLIO_NAME_MAX_LENGTH } from '../../portfolios/api/portfolio-schemas';
import { validatePortfolioName } from '../../portfolios/lib/portfolio-validation';

export interface RenamePortfolioDialogProps {
  readonly currentName: string;
  readonly onClose: () => void;
  readonly onSubmit: (name: string) => void;
  readonly submitting: boolean;
}

/**
 * Renames a portfolio, seeded with the existing name so the common edit — fixing a typo — starts from the
 * current text rather than an empty field.
 *
 * Like the create dialog, mounted only while open, so `useState(currentName)` is the whole of the "reset
 * on open" behaviour.
 */
export function RenamePortfolioDialog({
  currentName,
  onClose,
  onSubmit,
  submitting,
}: RenamePortfolioDialogProps): React.JSX.Element {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | undefined>(undefined);

  const unchanged = name.trim() === currentName.trim();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const problem = validatePortfolioName(name);

    if (problem !== undefined) {
      setError(problem);
      return;
    }

    setError(undefined);
    onSubmit(name.trim());
  };

  return (
    <Modal open onClose={onClose} title="Rename portfolio" dismissible={!submitting}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Portfolio name"
          value={name}
          maxLength={PORTFOLIO_NAME_MAX_LENGTH}
          autoComplete="off"
          disabled={submitting}
          error={error}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {/* Disabled while unchanged: a PATCH that changes nothing is a round trip and a toast for no
              reason. */}
          <Button type="submit" loading={submitting} disabled={unchanged}>
            Save name
          </Button>
        </div>
      </form>
    </Modal>
  );
}
