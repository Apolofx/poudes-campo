import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FlagsProvider } from '@/ui/FlagsProvider';
import { ThemeGate } from '@/ui/components/ThemeGate';

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

function mockFlags(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
}

describe('ThemeGate', () => {
  it('aplica data-theme=dark cuando el flag darkMode está activo', async () => {
    mockFlags({ darkMode: true });
    render(
      <FlagsProvider>
        <ThemeGate />
      </FlagsProvider>,
    );

    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
  });

  it('aplica data-theme=light cuando el flag está apagado', async () => {
    mockFlags({ darkMode: false });
    render(
      <FlagsProvider>
        <ThemeGate />
      </FlagsProvider>,
    );

    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'));
  });
});
