import { useContext } from 'react';

import { ThemeContext, type ThemeApi } from './theme-context';

export type { ThemeApi, ThemePreference, ResolvedTheme } from './theme-context';

export function useTheme(): ThemeApi {
  const api = useContext(ThemeContext);

  if (api === null) {
    throw new Error('useTheme must be used within a <ThemeProvider>.');
  }

  return api;
}
