import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { FieldsListScreen } from '@/ui/screens/FieldsListScreen';
import { FieldFormScreen } from '@/ui/screens/FieldFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderAt(path: string, container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/catalogo/lotes" element={<FieldsListScreen />} />
          <Route path="/catalogo/lotes/nuevo" element={<FieldFormScreen />} />
          <Route path="/catalogo/lotes/:id" element={<FieldFormScreen />} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('FieldsListScreen', () => {
  it('lists active fields with their client/zone (or "Sin ...")', async () => {
    renderAt('/catalogo/lotes'); // fixture: f1/f2 con c1/z1
    expect(await screen.findByText('Lote El Alto')).toBeInTheDocument();
    expect(screen.getAllByText(/Pérez · Norte/).length).toBeGreaterThan(0);
  });

  it('archives a field', async () => {
    const c = renderAt('/catalogo/lotes');
    await screen.findByText('Lote El Alto');
    await userEvent.click(screen.getByRole('button', { name: /archivar Lote El Alto/i }));
    await waitFor(async () => expect((await c.listCatalogFields.execute()).find((r) => r.field.id === 'f1')?.field.archived).toBe(true));
  });
});

describe('FieldFormScreen', () => {
  it('creates a field with a name and optional zone', async () => {
    const c = renderAt('/catalogo/lotes/nuevo');
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Lote Nuevo');
    await userEvent.selectOptions(screen.getByLabelText(/zona/i), 'z1');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => {
      const rows = await c.listCatalogFields.execute();
      const created = rows.find((r) => r.field.name === 'Lote Nuevo');
      expect(created?.field.zoneId).toBe('z1');
    });
  });

  it('reassigns client to "Sin cliente" when editing', async () => {
    const c = renderAt('/catalogo/lotes/f1'); // f1 tiene c1
    await screen.findByDisplayValue('Lote El Alto');
    await userEvent.selectOptions(screen.getByLabelText(/cliente/i), ''); // opción "Sin cliente"
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listCatalogFields.execute()).find((r) => r.field.id === 'f1')?.field.clientId).toBeUndefined());
  });
});
