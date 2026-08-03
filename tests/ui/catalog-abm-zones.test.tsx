import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ZonesListScreen } from '@/ui/screens/ZonesListScreen';
import { ZoneFormScreen } from '@/ui/screens/ZoneFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderAt(path: string, container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/catalogo/zonas" element={<ZonesListScreen />} />
          <Route path="/catalogo/zonas/nueva" element={<ZoneFormScreen />} />
          <Route path="/catalogo/zonas/:id" element={<ZoneFormScreen />} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('ZonesListScreen (ABM genérico)', () => {
  it('lists active zones and hides archived by default', async () => {
    const c = makeInMemoryContainer();
    await c.createZone.execute('Sur');
    await c.archiveZone.execute('z1', false); // Norte del fixture → archivada
    renderAt('/catalogo/zonas', c);
    expect(await screen.findByText('Sur')).toBeInTheDocument();
    expect(screen.queryByText('Norte')).not.toBeInTheDocument();
  });

  it('navigates to edit when clicking anywhere on the row', async () => {
    const c = makeInMemoryContainer();
    await c.createZone.execute('Sur');
    renderAt('/catalogo/zonas', c);
    await userEvent.click(await screen.findByText('Sur'));
    expect(await screen.findByDisplayValue('Sur')).toBeInTheDocument();
  });

  it('reveals archived zones and restores one', async () => {
    const c = makeInMemoryContainer();
    await c.archiveZone.execute('z1', false);
    renderAt('/catalogo/zonas', c);
    await userEvent.click(await screen.findByRole('button', { name: /ver archivados/i }));
    expect(await screen.findByText('Norte')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /restaurar/i }));
    await waitFor(async () => expect((await c.listZones.execute()).find((z) => z.id === 'z1')?.archived).toBe(false));
  });

  it('prompts to cascade when archiving a zone with active fields; "keep fields" orphans them', async () => {
    const c = makeInMemoryContainer(); // fixture: z1 Norte con f1/f2 activos en z1
    renderAt('/catalogo/zonas', c);
    await screen.findByText('Norte');
    await userEvent.click(screen.getByRole('button', { name: /archivar Norte/i }));
    expect(await screen.findByText(/lotes activos/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /mantener los lotes/i })); // cascade=false
    await waitFor(async () => expect((await c.listZones.execute()).find((z) => z.id === 'z1')?.archived).toBe(true));
    const rows = await c.listCatalogFields.execute();
    expect(rows.filter((r) => !r.field.archived && r.field.zoneId === undefined).length).toBe(2);
  });

  it('prompts to cascade when archiving a zone with active fields; "archive fields too" cascades', async () => {
    const c = makeInMemoryContainer(); // fixture: z1 Norte con f1/f2 activos en z1
    renderAt('/catalogo/zonas', c);
    await screen.findByText('Norte');
    await userEvent.click(screen.getByRole('button', { name: /archivar Norte/i }));
    expect(await screen.findByText(/lotes activos/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /archivar también los lotes/i })); // cascade=true
    await waitFor(async () => expect((await c.listZones.execute()).find((z) => z.id === 'z1')?.archived).toBe(true));
    const rows = await c.listCatalogFields.execute();
    const f1 = rows.find((r) => r.field.id === 'f1');
    const f2 = rows.find((r) => r.field.id === 'f2');
    expect(f1?.field.archived).toBe(true);
    expect(f2?.field.archived).toBe(true);
  });
});

describe('ZoneFormScreen (ABM genérico)', () => {
  it('creates a zone', async () => {
    const c = renderAt('/catalogo/zonas/nueva');
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Oeste');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listZones.execute()).some((z) => z.name === 'Oeste')).toBe(true));
  });

  it('edits an existing zone (preloads the name)', async () => {
    const c = renderAt('/catalogo/zonas/z1'); // Norte
    expect(await screen.findByDisplayValue('Norte')).toBeInTheDocument();
    const input = screen.getByLabelText(/nombre/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Noreste');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(async () => expect((await c.listZones.execute()).find((z) => z.id === 'z1')?.name).toBe('Noreste'));
  });

  it('shows an error for an empty name', async () => {
    renderAt('/catalogo/zonas/nueva');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(await screen.findByText(/el nombre no puede estar vacío/i)).toBeInTheDocument();
  });
});
