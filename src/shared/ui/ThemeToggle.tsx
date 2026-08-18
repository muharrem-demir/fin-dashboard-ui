import { useTheme, type ThemePreference } from '../../app/providers/useTheme';

import { Monitor, Moon, Sun } from './icons';
import { IconButton } from './IconButton';

const NEXT_LABEL: Readonly<Record<ThemePreference, string>> = {
  light: 'Switch to dark theme',
  dark: 'Follow system theme',
  system: 'Switch to light theme',
};

const CURRENT_LABEL: Readonly<Record<ThemePreference, string>> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

export function ThemeToggle(): React.JSX.Element {
  const { preference, cycle } = useTheme();

  const icon =
    preference === 'light' ? (
      <Sun className="size-[18px]" />
    ) : preference === 'dark' ? (
      <Moon className="size-[18px]" />
    ) : (
      <Monitor className="size-[18px]" />
    );

  return (
    <IconButton
      variant="secondary"
      // The label names the destination, not the current state: a control's accessible name should
      // say what pressing it does.
      label={NEXT_LABEL[preference]}
      title={`${CURRENT_LABEL[preference]} — click to change`}
      icon={icon}
      onClick={cycle}
    />
  );
}
