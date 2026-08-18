export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  readonly id: string;
  readonly variant: ToastVariant;
  readonly title: string;
  readonly description?: string;
  /** Milliseconds before auto-dismissal; `0` keeps the toast until it is dismissed by hand. */
  readonly durationMs: number;
}

export interface ToastOptions {
  readonly description?: string;
  readonly durationMs?: number;
}

export interface ToastApi {
  readonly success: (title: string, options?: ToastOptions) => string;
  readonly error: (title: string, options?: ToastOptions) => string;
  readonly warning: (title: string, options?: ToastOptions) => string;
  readonly info: (title: string, options?: ToastOptions) => string;
  readonly dismiss: (id: string) => void;
  readonly dismissAll: () => void;
}

/**
 * Errors stay up twice as long as confirmations.
 *
 * A success toast repeats something the user just did and the screen already reflects; an error is
 * the only place the reason is written down, and losing it after three seconds means re-triggering
 * the failure to read it.
 */
export const DEFAULT_DURATIONS: Readonly<Record<ToastVariant, number>> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

/** Beyond this, the oldest toast is dropped — a stack taller than the viewport helps nobody. */
export const MAX_VISIBLE_TOASTS = 4;
