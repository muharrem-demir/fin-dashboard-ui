import { Link, Outlet } from 'react-router-dom';

import { appConfig } from '../config/app-config';
import { MarketIcon } from '../shared/ui/icons';
import { ThemeToggle } from '../shared/ui/ThemeToggle';

/**
 * The shell every page renders inside: a sticky header, a centred column, and a footer.
 *
 * The header is `sticky` rather than `fixed` so it participates in layout — a fixed header needs the
 * content padded to match, and the two drift apart the first time the header's height changes.
 */
export function AppLayout(): React.JSX.Element {
  const { name, environmentLabel } = appConfig.app;

  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      {/* Lets a keyboard user get past the header without tabbing through it on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-base/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm dark:bg-brand-500 dark:text-brand-950"
            >
              <MarketIcon className="size-5" />
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-base font-semibold tracking-tight text-content-primary">{name}</span>
              {environmentLabel !== '' && (
                <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wider text-amber-700 uppercase dark:text-amber-400">
                  {environmentLabel}
                </span>
              )}
            </span>
          </Link>

          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-border-subtle px-4 py-5 sm:px-6 lg:px-8">
        <p className="mx-auto max-w-7xl text-xs text-content-muted">
          Prices are provided for demonstration purposes and may be delayed or unavailable.
        </p>
      </footer>
    </div>
  );
}
