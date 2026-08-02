import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { ScheduledVisitDetailScreen } from '@/ui/screens/ScheduledVisitDetailScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

describe('ScheduledVisitDetailScreen', () => {
  it('shows the scheduled visit and cancels it', async () => {
    const c = makeInMemoryContainer();
    const { scheduledVisitId } = await c.scheduleVisit.execute({
      fieldId: 'f1',
      scheduledDate: new Date('2026-08-10T00:00:00.000Z'),
      reminderLeadDays: 3,
      notes: 'revisar',
    });
    render(
      <CampoProvider container={c}>
        <MemoryRouter initialEntries={[`/field/f1/programadas/${scheduledVisitId}`]}>
          <Routes>
            <Route path="/field/:fieldId/programadas/:scheduledVisitId" element={<ScheduledVisitDetailScreen />} />
            <Route path="/field/:fieldId/visitas" element={<div>Historial</div>} />
            <Route path="/field/:fieldId/programar/:scheduledVisitId" element={<div>Editar</div>} />
          </Routes>
        </MemoryRouter>
      </CampoProvider>,
    );

    expect(await screen.findByText(/ago/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Historial')).toBeInTheDocument();
  });
});
