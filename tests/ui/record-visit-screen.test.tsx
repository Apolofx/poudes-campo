import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

// `RecordVisitScreen` builds its default visit date from the real system clock
// (`todayIso()`), which tests can't inject into the component. So the use-case clock
// must track the real "today" — a hardcoded past date makes the default date look
// "future" and breaks these tests once the calendar rolls past it. Derive both the
// clock and any "future" date from the real now to keep this suite deterministic.
function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function renderScreen(now = new Date()) {
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
    await userEvent.type(dateInput, isoInDays(30));
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

  it('renders a back link to the search list', async () => {
    renderScreen();
    const back = await screen.findByRole('link', { name: /Buscar lote/ });
    expect(back).toHaveAttribute('href', '/buscar');
  });
});
