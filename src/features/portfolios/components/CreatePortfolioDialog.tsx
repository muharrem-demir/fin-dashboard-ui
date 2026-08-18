import { useState, type FormEvent } from 'react';

import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { TextField } from '../../../shared/ui/TextField';
import { PORTFOLIO_NAME_MAX_LENGTH } from '../api/portfolio-schemas';
import { validatePortfolioName } from '../lib/portfolio-validation';

export interface CreatePortfolioDialogProps {
  readonly onClose: () => void;
  readonly onSubmit: (name: string) => void;
  readonly submitting: boolean;
}

/**
 * Asks for a name and nothing else.
 *
 * Mounted only while it is open, which is why there is no effect resetting the fields: closing unmounts
 * the component and the next open starts from a fresh `useState`. That is both less code and less to go
 * wrong than clearing state in response to a prop change.
 */
export function CreatePortfolioDialog({
  onClose,
  onSubmit,
  submitting,
}: CreatePortfolioDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

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
    <Modal
      open
      onClose={onClose}
      title="New portfolio"
      description="Name it now — you can add holdings on the next screen."
      dismissible={!submitting}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Portfolio name"
          placeholder="e.g. Growth"
          value={name}
          maxLength={PORTFOLIO_NAME_MAX_LENGTH}
          autoComplete="off"
          disabled={submitting}
          error={error}
          hint={`${String(name.trim().length)} of ${String(PORTFOLIO_NAME_MAX_LENGTH)} characters`}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create portfolio
          </Button>
        </div>
      </form>
    </Modal>
  );
}
