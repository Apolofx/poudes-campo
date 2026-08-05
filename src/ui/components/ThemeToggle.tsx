import { useTheme } from '@/ui/ThemeProvider';
import { THEME_OPTIONS } from '@/ui/theme';

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="segmented" role="group" aria-label="Tema">
      {THEME_OPTIONS.map((option) => (
        <label className="segment" key={option.value}>
          <input
            type="radio"
            name="theme"
            checked={preference === option.value}
            onChange={() => setPreference(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
