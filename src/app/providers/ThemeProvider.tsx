import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type ThemeApi,
  type ThemePreference,
} from './theme-context';

const ORDER: readonly ThemePreference[] = ['light', 'dark', 'system'];

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * `system` is the default, not `light`.
 *
 * A dashboard someone opens at their desk should match the rest of their machine on first paint; only an
 * explicit choice is worth persisting.
 */
function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    // Private browsing modes can throw on access rather than returning null.
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

export function ThemeProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readStoredPreference()));

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setResolved(resolve(next));

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persistence is a nicety; the session still works without it.
    }
  }, []);

  const cycle = useCallback(() => {
    setPreferenceState((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
      setResolved(resolve(next));

      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // As above.
      }

      return next;
    });
  }, []);

  // While the preference is `system`, follow the OS if it changes mid-session — someone whose machine
  // switches at sunset expects the open tab to follow.
  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');

    const onChange = (event: MediaQueryListEvent): void => {
      setResolved(event.matches ? 'dark' : 'light');
    };

    query.addEventListener('change', onChange);

    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [preference]);

  // The class on <html> is what every `dark:` utility keys off; see the @custom-variant in index.css.
  // Writing to the DOM is exactly what an effect is for — this is the external system being synchronised.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const api = useMemo<ThemeApi>(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle],
  );

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}
