import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ScheduledVisitFormScreen } from '@/ui/screens/ScheduledVisitFormScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

// `ScheduledVisitFormScreen` builds its default date from the real system clock,
// so the test derives dates from real "now" to stay deterministic (same approach
// as `record-visit-screen.test.tsx`).
function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function renderForm(path = '/field/f1/programar', container = makeInMemoryContainer()) {
  return render(
    <CampoProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<div>Inicio</div>} />
          <Route path="/programar" element={<ScheduledVisitFormScreen />} />
          <Route path="/field/:fieldId/programar" element={<ScheduledVisitFormScreen />} />
          <Route path="/field/:fieldId/programar/:scheduledVisitId" element={<ScheduledVisitFormScreen />} />
          <Route path="/field/:fieldId/visitas" element={<div>Historial</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('ScheduledVisitFormScreen', () => {
  it('schedules a visit and navigates back to the history', async () => {
    renderForm();
    const date = isoInDays(10);
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, date);
    await userEvent.click(screen.getByRole('button', { name: /Programar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
  });

  it('minimiza la fecha a mañana', () => {
    renderForm();
    const input = screen.getByLabelText('Fecha') as HTMLInputElement;
    expect(input).toHaveAttribute('min', isoInDays(1));
  });

  it('edits an existing scheduled visit', async () => {
    const c = makeInMemoryContainer();
    const { scheduledVisitId } = await c.scheduleVisit.execute({
      fieldId: 'f1',
      scheduledDate: new Date(`${isoInDays(10)}T00:00:00.000Z`),
      reminderLeadDays: 3,
    });
    renderForm(`/field/f1/programar/${scheduledVisitId}`, c);
    await userEvent.clear(screen.getByLabelText('Notas'));
    await userEvent.type(screen.getByLabelText('Notas'), 'revisar siembra');
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
  });

  it('crea lote, zona y cliente nuevos y agenda desde /programar', async () => {
    const c = makeInMemoryContainer();
    await c.clearAllData.execute();
    renderForm('/programar', c);
    await userEvent.type(screen.getByLabelText('Lote'), 'Paso 9');
    await userEvent.type(screen.getByLabelText('Zona'), 'La Costa');
    await userEvent.type(screen.getByLabelText('Cliente'), 'Herrera');
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, isoInDays(10));
    await userEvent.click(screen.getByRole('button', { name: /Programar/ }));

    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect((await c.listZones.execute()).map((z) => z.name)).toEqual(['La Costa']);
    expect((await c.listClients.execute()).map((cl) => cl.name)).toEqual(['Herrera']);
    expect((await c.listCatalogFields.execute()).map((f) => f.field.name)).toEqual(['Paso 9']);
    expect((await c.listUpcomingVisits.execute()).map((u) => u.field.name)).toContain('Paso 9');
  });

  it('permite elegir un lote existente y agenda para ese lote', async () => {
    const c = makeInMemoryContainer();
    renderForm('/programar', c);
    await userEvent.type(screen.getByLabelText('Lote'), 'Alto');
    await userEvent.click(screen.getByRole('button', { name: 'Lote El Alto' }));
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, isoInDays(10));
    await userEvent.click(screen.getByRole('button', { name: /Programar/ }));

    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect(await c.listCatalogFields.execute()).toHaveLength(2);
    expect((await c.listUpcomingVisits.execute()).map((u) => u.field.name)).toContain('Lote El Alto');
  });

  it('muestra el lote como chip fijo al entrar con lote conocido', async () => {
    renderForm('/field/f1/programar');
    expect(await screen.findByText(/Lote: Lote El Alto/)).toBeInTheDocument();
  });
});
