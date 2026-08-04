import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
import { ConfigScreen } from '@/ui/screens/ConfigScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderConfig(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <MemoryRouter initialEntries={['/configuracion']}>
          <Routes>
            <Route path="/" element={<div>Inicio</div>} />
            <Route path="/configuracion" element={<ConfigScreen />} />
          </Routes>
        </MemoryRouter>
      </TenantConfigProvider>
    </CampoProvider>,
  );
  return container;
}

describe('ConfigScreen', () => {
  it('muestra el form con clave (password) y URL', async () => {
    renderConfig();

    await screen.findByRole('heading', { name: 'Configuración' });
    expect(screen.getByLabelText(/Clave de acceso/)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/URL de la API/)).toBeInTheDocument();
  });

  it('submit vacío muestra error', async () => {
    renderConfig();

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Completá la clave/);
  });

  it('submit con clave y URL persiste y navega a Inicio', async () => {
    const container = renderConfig();

    await screen.findByRole('heading', { name: 'Configuración' });
    await userEvent.type(screen.getByLabelText(/Clave de acceso/), 'tnt_t1_secret');
    const urlField = screen.getByLabelText(/URL de la API/);
    await userEvent.clear(urlField);
    await userEvent.type(urlField, 'https://api.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    await expect(container.getTenantConfig()).resolves.toEqual({
      apiUrl: 'https://api.example.com',
      apiKey: 'tnt_t1_secret',
    });
  });
});
