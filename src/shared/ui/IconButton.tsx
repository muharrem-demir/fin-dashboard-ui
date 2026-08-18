import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

import { Spinner } from './Spinner';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: an icon-only control has no text for a screen reader to fall back on. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly variant?: 'ghost' | 'danger-ghost' | 'secondary';
  readonly loading?: boolean;
}

const VARIANTS = {
  ghost: 'text-content-muted hover:bg-surface-hover hover:text-content-primary',
  'danger-ghost': 'text-content-muted hover:bg-loss-500/10 hover:text-loss-600 dark:hover:text-loss-400',
  secondary: 'border border-border-strong bg-surface-raised text-content-secondary hover:bg-surface-hover',
} as const satisfies Record<string, string>;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', loading = false, className, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      title={label}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled === true || loading}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:pointer-events-none disabled:opacity-55',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" label={label} /> : icon}
    </button>
  );
});
