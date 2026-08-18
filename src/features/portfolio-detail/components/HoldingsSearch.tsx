import { useRef } from 'react';

import { Search, X } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import { TextField } from '../../../shared/ui/TextField';

export interface HoldingsSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** How many rows survive the current filter, and how many exist — reported to the user as it changes. */
  readonly matchCount: number;
  readonly totalCount: number;
}

/**
 * Filters the holdings table by ticker as the user types.
 *
 * There is no submit button and no debounce: the list is already in memory and capped at fifty rows, so
 * filtering on every keystroke costs a `filter` over a short array and gives the user the immediate
 * feedback a search box implies. Nothing here touches the network.
 *
 * The clear control is a real button inside the field rather than the browser's own — `type="search"`
 * paints one in some engines and not others, and it cannot be labelled, so the native one is suppressed
 * and this takes its place. Clearing returns focus to the input, because the user's next move after
 * emptying a search is almost always to type a different one.
 */
export function HoldingsSearch({ value, onChange, matchCount, totalCount }: HoldingsSearchProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const searching = value.trim() !== '';

  const clear = (): void => {
    onChange('');
    input.current?.focus();
  };

  return (
    <div className="border-b border-border-subtle px-4 py-3 sm:px-5">
      <TextField
        ref={input}
        type="search"
        label="Filter by ticker"
        placeholder="Search holdings"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          // Escape is what a search field is expected to do; it saves reaching for the clear button.
          if (event.key === 'Escape' && value !== '') {
            event.preventDefault();
            clear();
          }
        }}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        leading={<Search className="size-4" />}
        trailing={
          value !== '' ? <IconButton label="Clear search" icon={<X className="size-4" />} onClick={clear} /> : undefined
        }
        hint={
          <span role="status">
            {searching
              ? `${String(matchCount)} of ${String(totalCount)} ${totalCount === 1 ? 'holding' : 'holdings'} shown`
              : 'Rows whose ticker contains what you type stay visible.'}
          </span>
        }
        className="[&::-webkit-search-cancel-button]:appearance-none"
        containerClassName="max-w-sm"
      />
    </div>
  );
}
