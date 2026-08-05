import { Moon, Monitor, Sun, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/ui/ThemeProvider';
import { THEME_OPTIONS, type ThemePreference } from '@/ui/theme';

const ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  system: Monitor,
  dark: Moon,
};

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="segmented" role="group" aria-label="Tema">
      {THEME_OPTIONS.map((option) => {
        const Icon = ICONS[option.value];
        return (
          <label className="segment" key={option.value}>
            <input
              type="radio"
              name="theme"
              checked={preference === option.value}
              onChange={() => setPreference(option.value)}
            />
            <span>
              <Icon size={15} aria-hidden="true" />
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
