import { Component, type ErrorInfo, type ReactNode } from 'react';

import { logger } from '../shared/lib/logger';
import { Button } from '../shared/ui/Button';
import { CircleAlert, RefreshCw } from '../shared/ui/icons';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * The last line of defence: a render-time crash shows a page instead of a white screen.
 *
 * Still a class component, because `componentDidCatch` has no hook equivalent — React has no
 * function-component API for catching render errors, so this is the idiomatic form rather than a
 * legacy one.
 *
 * Recovery clears the error and re-renders rather than reloading. If the cause was transient — a
 * malformed frame, a race during navigation — the user keeps their place; if it was not, the boundary
 * catches it again immediately and the reload button is right there.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Unhandled error in the React tree', {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  private readonly reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;

    if (error === null) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base p-6">
        <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-card border border-border-subtle bg-surface-raised p-8 text-center shadow-card">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-2xl bg-loss-500/10 text-loss-600 dark:text-loss-400"
          >
            <CircleAlert className="size-7" />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-semibold text-content-primary">Something broke</h1>
            <p className="text-sm text-content-secondary">
              The dashboard hit an unexpected error and stopped rendering. Your data is unaffected.
            </p>
            {/* The message is shown because it is the only clue a user can pass on in a bug report. */}
            <p className="mt-1 rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs break-words text-content-muted">
              {error.message}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={this.reload}>
              Reload the page
            </Button>
            <Button onClick={this.reset}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }
}
