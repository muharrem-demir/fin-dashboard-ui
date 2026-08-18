import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names and lets the last Tailwind utility in a conflicting pair win.
 *
 * Without the merge step, a component's own `px-4` and a caller's `px-2` both land in the class
 * list and the winner is whichever CSS rule the stylesheet happens to order last — which makes
 * overriding a variant from the outside unpredictable.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
