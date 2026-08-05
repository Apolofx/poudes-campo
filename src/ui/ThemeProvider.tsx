import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  loadThemePreference,
  resolveEffectiveTheme,
  saveThemePreference,
  systemPrefersDark,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  type ThemePreference,
} from '@/ui/theme';

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  setPreference: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadThemePreference);

  useEffect(() => {
    const apply = () => {
      const theme = resolveEffectiveTheme(preference, systemPrefersDark());
      document.documentElement.setAttribute('data-theme', theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
    };

    apply();
    if (preference === 'system') {
      try {
        const query = window.matchMedia('(prefers-color-scheme: dark)');
        query.addEventListener('change', apply);
        return () => query.removeEventListener('change', apply);
      } catch {
        // matchMedia no disponible (jsdom)
      }
    }
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    saveThemePreference(next);
  };

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
