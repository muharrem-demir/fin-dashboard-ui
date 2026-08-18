import { createContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeApi {
  /** What the user chose, including `system`. */
  readonly preference: ThemePreference;
  /** What is actually on screen — `system` resolved against the OS setting. */
  readonly resolved: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
  /** Steps light → dark → system, for the header toggle. */
  readonly cycle: () => void;
}

/**
 * Separate from the provider component so that editing either one can be hot-reloaded: a module that
 * exports both a component and a context defeats Fast Refresh.
 */
export const ThemeContext = createContext<ThemeApi | null>(null);

/** Shared with the inline script in index.html, which applies the theme before first paint. */
export const THEME_STORAGE_KEY = 'fin-dashboard.theme';
