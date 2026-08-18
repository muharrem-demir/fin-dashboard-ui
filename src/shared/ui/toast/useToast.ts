import { useContext } from 'react';

import { ToastContext } from './toast-context';
import type { ToastApi } from './toast-types';

/**
 * Access to the toast stack.
 *
 * Throws when no provider is above it, rather than returning a no-op API. A missing provider means every
 * error message in that subtree is silently swallowed, and a hard failure in development is far cheaper to
 * find than the absence of a toast nobody noticed.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);

  if (api === null) {
    throw new Error('useToast must be used within a <ToastProvider>.');
  }

  return api;
}
