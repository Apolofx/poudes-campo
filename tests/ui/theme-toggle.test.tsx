import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/ui/ThemeProvider';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { THEME_STORAGE_KEY } from '@/ui/theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

function renderToggle() {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('ThemeToggle', () => {
  it('cambia a Oscuro, lo aplica y lo persiste', async () => {
    renderToggle();
    await userEvent.click(await screen.findByRole('radio', { name: 'Oscuro' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('vuelve a Claro', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderToggle();
    await screen.findByRole('radio', { name: 'Oscuro' });

    await userEvent.click(screen.getByRole('radio', { name: 'Claro' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
