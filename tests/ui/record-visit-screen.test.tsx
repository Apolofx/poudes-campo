import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderScreen(now = new Date('2026-07-27T12:00:00Z')) {
  return render(
    <CampoProvider container={makeInMemoryContainer(now)}>
      <MemoryRouter initialEntries={['/field/f1/record']}>
        <Routes>
          <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
          <Route path="/" element={<div>Listado</div>} />
        </Routes>
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('RecordVisitScreen', () => {
  it('records a visit and navigates back to the list', async () => {
    renderScreen();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    expect(await screen.findByText('Listado')).toBeInTheDocument();
  });

  it('shows a Spanish message on a domain error (future date)', async () => {
    renderScreen();
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '2026-08-15');
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no puede ser futura/i),
    );
  });
});
