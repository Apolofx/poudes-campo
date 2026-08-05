import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FlagsProvider, useFlag, useFlagsLoading } from '@/ui/FlagsProvider';

function Probe({ name }: { name: string }) {
  return <div data-testid={`flag-${name}`}>{String(useFlag(name))}</div>;
}

function LoadingProbe() {
  return <div data-testid="loading">{String(useFlagsLoading())}</div>;
}

function mockFlags(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
}

function mockFetchFailure() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FlagsProvider', () => {
  it('expone los flags que devuelve /api/flags', async () => {
    mockFlags({ darkMode: true });
    render(
      <FlagsProvider>
        <Probe name="darkMode" />
        <Probe name="agendaSemanal" />
      </FlagsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('flag-darkMode')).toHaveTextContent('true'));
    expect(screen.getByTestId('flag-agendaSemanal')).toHaveTextContent('false');
  });

  it('default false si el fetch falla', async () => {
    mockFetchFailure();
    render(
      <FlagsProvider>
        <Probe name="darkMode" />
      </FlagsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('flag-darkMode')).toHaveTextContent('false'));
  });

  it('default false si /api/flags no responde ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <FlagsProvider>
        <Probe name="darkMode" />
      </FlagsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('flag-darkMode')).toHaveTextContent('false'));
  });

  it('con initialFlags expone los flags sin esperar el fetch', () => {
    render(
      <FlagsProvider initialFlags={{ onboardingNuevo: true }}>
        <Probe name="onboardingNuevo" />
        <LoadingProbe />
      </FlagsProvider>,
    );

    expect(screen.getByTestId('flag-onboardingNuevo')).toHaveTextContent('true');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('loading true hasta que resuelve /api/flags', async () => {
    mockFlags({});
    render(
      <FlagsProvider>
        <LoadingProbe />
      </FlagsProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  });
});
