import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { FieldHistoryScreen } from '@/ui/screens/FieldHistoryScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';
import type { Container } from '@/composition/container';

async function seed(c: Container) {
  await c.recordVisit.execute({ fieldId: 'f1', visitDate: new Date('2026-07-20T10:00:00Z'), notes: 'primera', followUp: { kind: 'none' } });
  const r = await c.recordVisit.execute({ fieldId: 'f1', visitDate: new Date('2026-07-25T10:00:00Z'), notes: 'segunda', followUp: { kind: 'none' } });
  await c.cancelVisit.execute({ visitId: r.visitId });
}

function renderScreen(c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'))) {
  return render(
    <CampoProvider container={c}>
      <MemoryRouter initialEntries={['/field/f1/visitas']}>
        <Routes>
          <Route path="/field/:fieldId/visitas" element={<FieldHistoryScreen />} />
          <Route path="/field/:fieldId/visitas/:visitId" element={<div>Detalle</div>} />
          <Route path="/field/:fieldId/record" element={<div>Registrar</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('FieldHistoryScreen', () => {
  it('lists visits newest-first with a status badge', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    await seed(c);
    renderScreen(c);
    const rows = await screen.findAllByRole('link', { name: /jul/i });
    // la segunda (25 jul, cancelada) va primero
    expect(rows[0]).toHaveTextContent(/segunda/);
    expect(rows[0]).toHaveTextContent(/Cancelada/);
    expect(rows[1]).toHaveTextContent(/Activa/);
  });

  it('shows an empty state with a CTA to register when the field has no visits', async () => {
    renderScreen();
    expect(await screen.findByText(/no tiene visitas/i)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /Registrar tu primera visita/i });
    expect(cta).toHaveAttribute('href', '/field/f1/record');
  });

  it('shows Registrar/Programar actions in the header when the field has history', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    await seed(c);
    renderScreen(c);
    const link = await screen.findByRole('link', { name: /Registrar visita/i });
    expect(link).toHaveAttribute('href', '/field/f1/record');
  });

  it('shows scheduled visits with a badge and a Programar button', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    await c.scheduleVisit.execute({ fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3 });
    renderScreen(c);

    const link = await screen.findByRole('link', { name: /Programar visita/i });
    expect(link).toHaveAttribute('href', '/field/f1/programar');
    const row = await screen.findByRole('link', { name: /ago/i });
    expect(row).toHaveTextContent(/Programada/);
  });

  it('muestra el día UTC de una visita guardada a medianoche (igual que el form de edición)', async () => {
    const c = makeInMemoryContainer(new Date('2026-08-01T00:30:00.000Z'));
    await c.recordVisit.execute({ fieldId: 'f1', visitDate: new Date('2026-08-01T00:00:00.000Z'), notes: 'borde', followUp: { kind: 'none' } });
    renderScreen(c);

    const row = await screen.findByRole('link', { name: /borde/ });
    expect(row).toHaveTextContent(/01 de ago de 2026/);
  });
});
