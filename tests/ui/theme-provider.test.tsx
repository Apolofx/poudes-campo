import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/ui/ThemeProvider';
import { THEME_STORAGE_KEY, THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/ui/theme';

function addThemeColorMeta() {
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  document.head.appendChild(meta);
}

let mediaDark = false;
const mediaListeners: Array<() => void> = [];

function mockMatchMedia() {
  mediaDark = false;
  mediaListeners.length = 0;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: mediaDark,
      media: query,
      addEventListener: (_type: string, cb: () => void) => mediaListeners.push(cb),
      removeEventListener: () => undefined,
    })),
  });
}

function systemDarkChangesTo(dark: boolean) {
  mediaDark = dark;
  mediaListeners.forEach((cb) => cb());
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.querySelector('meta[name="theme-color"]')?.remove();
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe('ThemeProvider', () => {
  it('aplica y persiste la preferencia guardada en localStorage', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeProvider>{null}</ThemeProvider>);
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
  });

  it('default sistema: tema claro cuando el sistema es claro', async () => {
    mockMatchMedia();
    render(<ThemeProvider>{null}</ThemeProvider>);
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'));
  });

  it('sigue en vivo los cambios del sistema en modo system', async () => {
    mockMatchMedia();
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    render(<ThemeProvider>{null}</ThemeProvider>);
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'));

    systemDarkChangesTo(true);
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
  });

  it('sincroniza el meta theme-color con el tema', async () => {
    addThemeColorMeta();
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeProvider>{null}</ThemeProvider>);
    await waitFor(() =>
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(THEME_COLOR_DARK),
    );

    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeProvider>{null}</ThemeProvider>);
    await waitFor(() =>
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(THEME_COLOR_LIGHT),
    );
  });
});
