import { createContext } from 'react';

import type { ToastApi } from './toast-types';

/**
 * Kept apart from the provider component so that both stay hot-reloadable: a module exporting a component
 * and a context defeats Fast Refresh.
 */
export const ToastContext = createContext<ToastApi | null>(null);
