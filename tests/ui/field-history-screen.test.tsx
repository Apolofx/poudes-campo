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

  it('shows an empty state when the field has no visits', async () => {
    renderScreen();
    expect(await screen.findByText(/no tiene visitas/i)).toBeInTheDocument();
  });

  it('links to the record screen', async () => {
    renderScreen();
    const link = await screen.findByRole('link', { name: /Registrar visita/i });
    expect(link).toHaveAttribute('href', '/field/f1/record');
  });
});
