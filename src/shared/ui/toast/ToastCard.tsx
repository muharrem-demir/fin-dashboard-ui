import { cn } from '../../lib/cn';
import { CircleAlert, CircleCheck, CircleX, Info, X } from '../icons';

import type { Toast, ToastVariant } from './toast-types';

interface VariantStyle {
  readonly accent: string;
  readonly icon: React.JSX.Element;
}

const VARIANTS: Readonly<Record<ToastVariant, VariantStyle>> = {
  success: {
    accent: 'bg-gain-500',
    icon: <CircleCheck className="size-5 text-gain-600 dark:text-gain-400" />,
  },
  error: {
    accent: 'bg-loss-500',
    icon: <CircleX className="size-5 text-loss-600 dark:text-loss-400" />,
  },
  warning: {
    accent: 'bg-amber-500',
    icon: <CircleAlert className="size-5 text-amber-600 dark:text-amber-400" />,
  },
  info: {
    accent: 'bg-brand-500',
    icon: <Info className="size-5 text-brand-600 dark:text-brand-400" />,
  },
};

export interface ToastCardProps {
  readonly toast: Toast;
  readonly onDismiss: (id: string) => void;
}

export function ToastCard({ toast, onDismiss }: ToastCardProps): React.JSX.Element {
  const variant = VARIANTS[toast.variant];

  return (
    <div
      // The container is the live region; each toast is a plain node so re-rendering the stack does
      // not re-announce toasts that were already read out.
      data-variant={toast.variant}
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-pop"
    >
      <div aria-hidden="true" className={cn('w-1 shrink-0', variant.accent)} />

      <div className="flex flex-1 items-start gap-3 p-3.5">
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          {variant.icon}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-semibold text-content-primary">{toast.title}</p>
          {toast.description !== undefined && (
            // `break-words` because problem-detail messages can contain a long unbroken UUID.
            <p className="text-sm break-words text-content-secondary">{toast.description}</p>
          )}
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => {
            onDismiss(toast.id);
          }}
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-content-muted transition-colors hover:bg-surface-hover hover:text-content-primary"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
