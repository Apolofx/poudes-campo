import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { VisitDetailScreen } from '@/ui/screens/VisitDetailScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';
import type { Container } from '@/composition/container';

async function seedActive(c: Container): Promise<string> {
  const r = await c.recordVisit.execute({ fieldId: 'f1', visitedAt: new Date('2026-07-25T10:00:00Z'), notes: 'orig', next: { kind: 'none' } });
  return r.visitId;
}

function renderAt(c: Container, visitId: string) {
  return render(
    <CampoProvider container={c}>
      <MemoryRouter initialEntries={[`/field/f1/visitas/${visitId}`]}>
        <Routes>
          <Route path="/field/:fieldId/visitas/:visitId" element={<VisitDetailScreen />} />
          <Route path="/field/:fieldId/visitas" element={<div>Historial</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('VisitDetailScreen', () => {
  it('prefills the form with the visit notes', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    renderAt(c, id);
    const notes = (await screen.findByLabelText('Notas')) as HTMLTextAreaElement;
    expect(notes.value).toBe('orig');
  });

  it('saves an edit and navigates back to the history', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    renderAt(c, id);
    const notes = await screen.findByLabelText('Notas');
    await userEvent.clear(notes);
    await userEvent.type(notes, 'corregido');
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
    expect((await c.getVisit.execute(id))?.notes).toBe('corregido');
  });

  it('prefills the date input with the stored day', async () => {
    const c = makeInMemoryContainer(new Date('2026-08-01T00:30:00.000Z'));
    const r = await c.recordVisit.execute({ fieldId: 'f1', visitedAt: new Date('2026-08-01T00:00:00.000Z'), notes: '', next: { kind: 'none' } });
    renderAt(c, r.visitId);
    const date = (await screen.findByLabelText('Fecha')) as HTMLInputElement;
    expect(date.value).toBe('2026-08-01');
  });

  it('editing only the date keeps the prefilled notes intact', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    renderAt(c, id);
    const date = await screen.findByLabelText('Fecha');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-07-26');
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
    expect((await c.getVisit.execute(id))?.notes).toBe('orig');
  });

  it('cancels the visit after confirming and navigates back', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    renderAt(c, id);
    await userEvent.click(await screen.findByRole('button', { name: /Cancelar visita/ }));
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
    expect((await c.getVisit.execute(id))?.status).toBe('CANCELLED');
  });

  it('shows a cancelled visit read-only', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const id = await seedActive(c);
    await c.cancelVisit.execute({ visitId: id });
    renderAt(c, id);
    expect(await screen.findByText(/Cancelada/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Visita del.*jul/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar visita/ })).not.toBeInTheDocument();
  });

  it('shows a pending visit read-only with edit/cancel actions', async () => {
    const c = makeInMemoryContainer(new Date('2026-07-27T12:00:00Z'));
    const { visitId } = await c.scheduleVisit.execute({
      fieldId: 'f1',
      plannedFor: new Date('2026-08-10T00:00:00Z'),
      reminderLeadDays: 3,
      notes: 'revisar',
    });
    renderAt(c, visitId);

    expect(await screen.findByText(/Programada/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Visita programada del.*ago/ })).toBeInTheDocument();
    const editLink = screen.getByRole('link', { name: /Editar/ });
    expect(editLink).toHaveAttribute('href', `/field/f1/programar/${visitId}`);
    expect(screen.getByRole('button', { name: /Cancelar visita/ })).toBeInTheDocument();
  });
});
