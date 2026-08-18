import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ToastCard } from './ToastCard';
import { ToastContext } from './toast-context';
import {
  DEFAULT_DURATIONS,
  MAX_VISIBLE_TOASTS,
  type Toast,
  type ToastApi,
  type ToastOptions,
  type ToastVariant,
} from './toast-types';

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `toast-${String(sequence)}`;
}

/**
 * Holds the toast stack and renders it into a live region at the corner of the viewport.
 *
 * Timers are tracked in a ref keyed by toast id so that dismissing a toast by hand also cancels its
 * pending auto-dismissal — otherwise a stale timer fires later and removes whatever toast has since
 * taken that position in the stack.
 */
export function ToastProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);

    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    for (const timer of timers.current.values()) {
      clearTimeout(timer);
    }
    timers.current.clear();
    setToasts([]);
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, options?: ToastOptions): string => {
      const id = nextId();
      const durationMs = options?.durationMs ?? DEFAULT_DURATIONS[variant];

      const toast: Toast = {
        id,
        variant,
        title,
        description: options?.description,
        durationMs,
      };

      setToasts((current) => {
        const next = [...current, toast];
        const overflow = next.length - MAX_VISIBLE_TOASTS;

        if (overflow <= 0) {
          return next;
        }

        for (const dropped of next.slice(0, overflow)) {
          const timer = timers.current.get(dropped.id);

          if (timer !== undefined) {
            clearTimeout(timer);
            timers.current.delete(dropped.id);
          }
        }

        return next.slice(overflow);
      });

      if (durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => {
            dismiss(id);
          }, durationMs),
        );
      }

      return id;
    },
    [dismiss],
  );

  // Auto-dismiss timers outlive the provider otherwise: each one holds a closure over `dismiss` and
  // keeps the process's event loop alive after the tree is gone.
  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, options) => push('success', title, options),
      error: (title, options) => push('error', title, options),
      warning: (title, options) => push('warning', title, options),
      info: (title, options) => push('info', title, options),
      dismiss,
      dismissAll,
    }),
    [push, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            // `polite` rather than `assertive`: these announcements follow an action the user just
            // took, so interrupting whatever is being read would be the ruder choice.
            role="region"
            aria-live="polite"
            aria-label="Notifications"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:items-end"
          >
            {toasts.map((toast) => (
              <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
