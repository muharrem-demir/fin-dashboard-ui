import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /**
   * Marks an in-flight request. The button disables itself and swaps its leading icon for a
   * spinner, which is why every API-triggering button in the app passes a mutation's pending flag
   * here rather than managing `disabled` by hand.
   */
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  readonly fullWidth?: boolean;
  readonly children?: ReactNode;
}

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 dark:bg-brand-500 dark:hover:bg-brand-400 dark:active:bg-brand-300 dark:text-brand-950',
  secondary:
    'bg-surface-raised text-content-primary border border-border-strong hover:bg-surface-hover active:bg-surface-sunken',
  ghost: 'text-content-secondary hover:bg-surface-hover hover:text-content-primary',
  danger:
    'bg-loss-600 text-white shadow-sm hover:bg-loss-500 active:bg-loss-600 dark:bg-loss-500 dark:hover:bg-loss-400',
  'danger-ghost': 'text-loss-600 hover:bg-loss-500/10 dark:text-loss-400',
};

const SIZES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    fullWidth = false,
    className,
    disabled,
    type,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      ref={ref}
      // Buttons inside a <form> default to `submit`; the app has several dialogs where an
      // unqualified Cancel would otherwise submit the form it sits next to.
      type={type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-lg font-medium transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:pointer-events-none disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" label="Working" /> : icon}
      {children}
    </button>
  );
});
