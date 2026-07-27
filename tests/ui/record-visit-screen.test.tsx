import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('records a visit with the default "En una fecha" date and navigates back', async () => {
    renderScreen();
    await userEvent.click(screen.getByLabelText(/En una fecha/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    expect(await screen.findByText('Listado')).toBeInTheDocument();
  });

  it('marks "Días" with a min of 1 so the browser blocks an empty/zero submission', () => {
    renderScreen();
    const daysInput = screen.getByLabelText('Días') as HTMLInputElement;
    expect(daysInput).toHaveAttribute('min', '1');
  });

  it('marks "Avisar días antes" with a min of 0', () => {
    renderScreen();
    const leadInput = screen.getByLabelText('Avisar días antes') as HTMLInputElement;
    expect(leadInput).toHaveAttribute('min', '0');
  });

  it('falls back to a valid interval instead of sending 0/NaN when "Días" is cleared', async () => {
    // The `min` attribute stops a real browser from submitting an invalid value, but this
    // test bypasses native constraint validation (by dispatching `submit` directly instead of
    // clicking the button) to exercise the JS-level safeInterval/safeLead fallback itself.
    const { container } = renderScreen();
    const daysInput = screen.getByLabelText('Días') as HTMLInputElement;
    await userEvent.clear(daysInput);
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Listado')).toBeInTheDocument();
  });
});
