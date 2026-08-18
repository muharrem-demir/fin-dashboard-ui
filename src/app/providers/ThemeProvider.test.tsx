import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeToggle } from '../../shared/ui/ThemeToggle';

import { ThemeProvider } from './ThemeProvider';
import { THEME_STORAGE_KEY } from './theme-context';

/**
 * The theme's contract with the rest of the app.
 *
 * Worth testing rather than eyeballing: the only thing every `dark:` utility depends on is the `dark`
 * class on `<html>`, and whether it is there cannot be judged from a screenshot — a browser with forced
 * dark mode renders a correct light theme as dark, and a broken one looks identical.
 *
 * The inline script in index.html applies the same rule before first paint, so the storage key and the
 * class name are shared through `theme-context.ts` and asserted here.
 */
function setSystemPrefersDark(prefersDark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: prefersDark && query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderToggle(): void {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    setSystemPrefersDark(false);
  });

  it('follows the system preference when nothing has been chosen', () => {
    setSystemPrefersDark(true);

    renderToggle();

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('stays light when the system is light', () => {
    renderToggle();

    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('honours a stored choice over the system preference', () => {
    // The whole point of an explicit toggle: choosing light on a dark machine must stick.
    setSystemPrefersDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    renderToggle();

    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('cycles light → dark → system and back, persisting each choice', async () => {
    const user = userEvent.setup();
    setSystemPrefersDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    renderToggle();
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Follow system theme' }));
    // Back to system, which this machine reports as dark.
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement).toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('names the destination in the control label, not the current state', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderToggle();

    expect(screen.getByRole('button', { name: 'Follow system theme' })).toBeInTheDocument();
  });

  it('falls back to the system preference when storage holds something unrecognised', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    setSystemPrefersDark(true);

    renderToggle();

    expect(document.documentElement).toHaveClass('dark');
  });

  it('survives storage being unavailable, as it is in some private browsing modes', async () => {
    const user = userEvent.setup();
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('access denied');
    });

    expect(() => {
      renderToggle();
    }).not.toThrow();

    // Unreadable storage falls back to `system`, which this machine reports as light.
    expect(document.documentElement).not.toHaveClass('dark');

    // The toggle still works for the session; only persistence is lost.
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement).toHaveClass('dark');

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
