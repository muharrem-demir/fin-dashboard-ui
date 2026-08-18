import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly label: string;
  /** Shown under the field until an `error` replaces it. */
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly leading?: ReactNode;
  /**
   * A control rendered inside the right edge of the field — a clear button, say.
   *
   * Unlike {@link leading} this stays interactive, so anything put here must be reachable by keyboard
   * and carry its own accessible name.
   */
  readonly trailing?: ReactNode;
  readonly containerClassName?: string;
}

/**
 * A labelled input that wires up its own accessibility relationships.
 *
 * The label/description/error ids are generated with `useId` rather than asked for, because the
 * forms here are rendered inside dialogs that can be opened more than once per page — hand-written
 * ids collide the moment two instances exist.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, leading, trailing, className, containerClassName, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error !== '';

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <label htmlFor={id} className="text-sm font-medium text-content-secondary">
        {label}
      </label>

      <div className="relative">
        {leading !== undefined && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted">
            {leading}
          </span>
        )}

        <input
          ref={ref}
          id={id}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : hint !== undefined ? hintId : undefined}
          className={cn(
            'h-10 w-full rounded-lg border bg-surface-base px-3 text-sm text-content-primary transition-colors',
            'placeholder:text-content-muted',
            'focus:outline-2 focus:outline-offset-0 focus:outline-brand-500',
            'disabled:cursor-not-allowed disabled:opacity-60',
            hasError ? 'border-loss-500' : 'border-border-strong hover:border-brand-400',
            leading !== undefined && 'pl-9',
            trailing !== undefined && 'pr-11',
            className,
          )}
          {...rest}
        />

        {trailing !== undefined && <span className="absolute top-1/2 right-1 -translate-y-1/2">{trailing}</span>}
      </div>

      {hasError ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-loss-600 dark:text-loss-400">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p id={hintId} className="text-xs text-content-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
});
