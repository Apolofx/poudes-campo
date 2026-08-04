import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
import { App } from '@/ui/App';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderApp(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
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
});
