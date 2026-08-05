export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'campo.theme';
export const THEME_COLOR_LIGHT = '#f7f6f1';
export const THEME_COLOR_DARK = '#12160f';

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
  { value: 'dark', label: 'Oscuro' },
];

export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // storage no disponible
  }
  return 'system';
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // storage no disponible
  }
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    // matchMedia no disponible (jsdom)
    return false;
  }
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): 'light' | 'dark' {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}
