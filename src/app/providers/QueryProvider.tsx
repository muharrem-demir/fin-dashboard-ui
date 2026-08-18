import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createQueryClient } from './query-client';

/**
 * The client is created in state rather than at module scope so that each mounted tree — including each
 * test — gets its own cache. A module-level client leaks data between tests and makes their order matter.
 */
export function QueryProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [client] = useState(createQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
