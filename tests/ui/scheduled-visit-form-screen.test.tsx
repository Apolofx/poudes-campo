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
});
