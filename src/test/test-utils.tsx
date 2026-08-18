import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ToastProvider } from '../shared/ui/toast/ToastProvider';
import { ThemeProvider } from '../app/providers/ThemeProvider';

/**
 * Renders a component inside the providers the app gives it, so a test exercises the same tree the
 * browser does.
 *
 * The query client is rebuilt per render with retries off and no cache lifetime — a retry inside a test
 * turns an assertion about one failed request into a three-second wait, and a shared cache makes tests
 * pass or fail depending on their order.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // `retryDelay` still applies to queries that set their own `retry` policy — `useQuotesBatch`
        // does, deliberately — so without this a test asserting on a failed request would wait out the
        // production backoff and time out before the error ever reached the screen.
        retryDelay: 0,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL, for components that read route params. */
  readonly route?: string;
  readonly queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  readonly queryClient: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient = createTestQueryClient(), ...options }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  function Wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
    return (
      <ThemeProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}
