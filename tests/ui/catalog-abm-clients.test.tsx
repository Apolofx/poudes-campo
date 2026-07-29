import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ClientsListScreen } from '@/ui/screens/ClientsListScreen';
import { ClientFormScreen } from '@/ui/screens/ClientFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderAt(path: string, container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/catalogo/clientes" element={<ClientsListScreen />} />
          <Route path="/catalogo/clientes/nuevo" element={<ClientFormScreen />} />
          <Route path="/catalogo/clientes/:id" element={<ClientFormScreen />} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('ClientsListScreen (ABM genérico)', () => {
  it('lists active clients and hides archived by default', async () => {
    const c = makeInMemoryContainer();
    await c.createClient.execute('Gómez');
    await c.archiveClient.execute('c1', true); // Pérez del fixture (con f1/f2) → cascada
    renderAt('/catalogo/clientes', c);
    expect(await screen.findByText('Gómez')).toBeInTheDocument();
    expect(screen.queryByText('Pérez')).not.toBeInTheDocument();
  });

  it('prompts to cascade when archiving a client with active fields; "keep fields" orphans them', async () => {
    const c = makeInMemoryContainer(); // fixture: c1 Pérez con f1/f2 activos
    renderAt('/catalogo/clientes', c);
    await screen.findByText('Pérez');
    await userEvent.click(screen.getByRole('button', { name: /archivar Pérez/i }));
    expect(await screen.findByText(/este cliente tiene 2 lotes activos/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /mantener los lotes/i }));
    await waitFor(async () => expect((await c.listClients.execute()).find((x) => x.id === 'c1')?.archived).toBe(true));
    const rows = await c.listCatalogFields.execute();
    expect(rows.filter((r) => !r.field.archived && r.field.clientId === undefined).length).toBe(2);
  });

  it('creates a client and shows an error for an empty name', async () => {
    const c = renderAt('/catalogo/clientes/nuevo');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(await screen.findByText(/el nombre no puede estar vacío/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Gómez');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listClients.execute()).some((x) => x.name === 'Gómez')).toBe(true));
  });
});
