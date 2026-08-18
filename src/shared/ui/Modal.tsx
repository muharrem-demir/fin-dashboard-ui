import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../lib/cn';

import { IconButton } from './IconButton';
import { X } from './icons';

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** Suppresses Escape and backdrop dismissal while a request is in flight. */
  readonly dismissible?: boolean;
  readonly className?: string;
}

/**
 * A modal dialog rendered into `document.body`.
 *
 * Built rather than borrowed, so the two behaviours that matter most here are explicit: focus moves
 * into the dialog on open and back to the trigger on close, and dismissal can be switched off while
 * a mutation is running — closing a dialog mid-request would leave the user with no idea whether
 * their portfolio was deleted.
 *
 * The portal matters for stacking: a dialog opened from inside a card must not be clipped by that
 * card's `overflow-hidden`.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  className,
}: ModalProps): React.JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  const requestClose = useCallback(() => {
    if (dismissible) {
      onClose();
    }
  }, [dismissible, onClose]);

  // Remember the trigger before the dialog steals focus, then hand it back on close. Without this,
  // dismissing a dialog drops the keyboard user at the top of the document.
  useEffect(() => {
    if (!open) {
      return;
    }

    restoreFocusTo.current = document.activeElement;

    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, button:not([data-autofocus="false"]), [href], [tabindex]:not([tabindex="-1"])',
    );

    firstField?.focus();

    return () => {
      if (restoreFocusTo.current instanceof HTMLElement) {
        restoreFocusTo.current.focus();
      }
    };
  }, [open]);

  // The page behind a modal must not scroll — on touch devices especially, a scrolling backdrop
  // makes the dialog feel detached from the app.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      // A minimal focus trap: enough to keep Tab cycling inside the dialog, which is what a
      // three-control dialog actually needs.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );

      if (focusable === undefined || focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (first === undefined || last === undefined) {
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, requestClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        onClick={requestClose}
        className="absolute inset-0 animate-fade-in bg-overlay backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        className={cn(
          'relative z-10 flex w-full max-w-md animate-dialog-in flex-col rounded-t-2xl border border-border-subtle bg-surface-raised shadow-pop sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold text-content-primary">
              {title}
            </h2>
            {description !== undefined && (
              <p id={descriptionId} className="text-sm text-content-secondary">
                {description}
              </p>
            )}
          </div>

          <IconButton
            label="Close dialog"
            icon={<X className="size-4" />}
            onClick={requestClose}
            disabled={!dismissible}
            data-autofocus="false"
          />
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer !== undefined && (
          <div className="flex flex-col-reverse gap-2 border-t border-border-subtle px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
