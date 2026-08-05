import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
import { FlagsProvider, type FlagValues } from '@/ui/FlagsProvider';
import { App } from '@/ui/App';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderApp(container = makeInMemoryContainer(), initialFlags: FlagValues = {}) {
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <FlagsProvider initialFlags={initialFlags}>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </FlagsProvider>
      </TenantConfigProvider>
    </CampoProvider>,
  );
}

describe('ConfigGate', () => {
  it('sin config redirige a /configuracion', async () => {
    renderApp(makeInMemoryContainer());

    expect(await screen.findByRole('heading', { name: 'Configuración' })).toBeInTheDocument();
  });

  it('con config seed muestra las tabs (Inicio)', async () => {
    renderApp(
      makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'), {
        apiUrl: 'https://api.example.com',
        apiKey: 'tnt_t1_secret',
      }),
    );

    expect(await screen.findByRole('heading', { name: /Próximas visitas/ })).toBeInTheDocument();
  });

  it('flag on + sin config redirige al onboarding (paso 1)', async () => {
    renderApp(makeInMemoryContainer(), { onboardingNuevo: true });

    expect(await screen.findByRole('heading', { name: 'Bienvenido a Campo' })).toBeInTheDocument();
  });

  it('flag on + config pero sin lotes redirige al onboarding (paso 2)', async () => {
    const container = makeInMemoryContainer(undefined, {
      apiUrl: 'https://api.example.com',
      apiKey: 'tnt_t1_secret',
    });
    await container.clearAllData.execute();
    renderApp(container, { onboardingNuevo: true });

    expect(await screen.findByRole('heading', { name: 'Tu primer lote' })).toBeInTheDocument();
  });

  it('flag on + config + con lotes muestra las tabs', async () => {
    renderApp(
      makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'), {
        apiUrl: 'https://api.example.com',
        apiKey: 'tnt_t1_secret',
      }),
      { onboardingNuevo: true },
    );

    expect(await screen.findByRole('heading', { name: /Próximas visitas/ })).toBeInTheDocument();
  });
});
