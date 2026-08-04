import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';
import { localFutureIso, localTodayIso } from '@/ui/date-utils';

// `RecordVisitScreen` builds its default visit date from the real system clock
// (`localTodayIso()`), which tests can't inject into the component. So the use-case clock
// must track the real "today" — a hardcoded past date makes the default date look
// "future" and breaks these tests once the calendar rolls past it. Derive both the
// clock and any "future" date from the real now to keep this suite deterministic.

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

async function expandNextVisit() {
  await userEvent.click(screen.getByRole('button', { name: /Próxima|Programar próxima/ }));
}
describe('RecordVisitScreen', () => {
  it('records a visit and navigates back to the list', async () => {
    renderScreen();
    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    expect(await screen.findByText('Listado')).toBeInTheDocument();
  });

  it('shows a Spanish message on a domain error (future date)', async () => {
    // The `max` attribute now stops a real browser from submitting a future date; this
    // test bypasses native constraint validation (dispatching `submit` directly) to
    // exercise the domain error path itself.
    const { container } = renderScreen();
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, localFutureIso(30));
    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no puede ser futura/i),
    );
  });

  it('records a visit with the default "En una fecha" date and navigates back', async () => {
    renderScreen();
    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/En una fecha/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    expect(await screen.findByText('Listado')).toBeInTheDocument();
  });

  it('marks "Días" with a min of 1 so the browser blocks an empty/zero submission', async () => {
    renderScreen();
    await expandNextVisit();
    const daysInput = screen.getByLabelText('Días') as HTMLInputElement;
    expect(daysInput).toHaveAttribute('min', '1');
  });

  it('marks "Avisar días antes" with a min of 0', async () => {
    renderScreen();
    await expandNextVisit();
    const leadInput = screen.getByLabelText('Avisar días antes') as HTMLInputElement;
    expect(leadInput).toHaveAttribute('min', '0');
  });

  it('falls back to a valid interval instead of sending 0/NaN when "Días" is cleared', async () => {
    // The `min` attribute stops a real browser from submitting an invalid value, but this
    // test bypasses native constraint validation (by dispatching `submit` directly instead of
    // clicking the button) to exercise the JS-level safeInterval/safeLead fallback itself.
    const { container } = renderScreen();
    await expandNextVisit();
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

  it('uses the previous view passed in location state as back link', async () => {
    render(
      <CampoProvider container={makeInMemoryContainer()}>
        <MemoryRouter
          initialEntries={[{ pathname: '/field/f1/record', state: { back: { label: 'Próximas visitas', to: '/' } } }]}
        >
          <Routes>
            <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
            <Route path="/" element={<div>Listado</div>} />
          </Routes>
        </MemoryRouter>
      </CampoProvider>,
    );
    const back = await screen.findByRole('link', { name: /Próximas visitas/ });
    expect(back).toHaveAttribute('href', '/');
  });

  it('limita el aviso al intervalo (max en el input de lead)', async () => {
    renderScreen();
    await expandNextVisit();
    const lead = screen.getByLabelText('Avisar días antes') as HTMLInputElement;
    expect(lead).toHaveAttribute('max', '14');
  });

  it('ofrece presets de intervalo (7/10/14) y tocar uno llena el input de Días', async () => {
    renderScreen();
    await expandNextVisit();
    const diasGroup = screen.getByRole('group', { name: /Días rápido/ });
    const daysInput = screen.getByLabelText('Días') as HTMLInputElement;
    await userEvent.click(within(diasGroup).getByRole('button', { name: '7' }));
    expect(daysInput).toHaveValue(7);
    await userEvent.click(within(diasGroup).getByRole('button', { name: '14' }));
    expect(daysInput).toHaveValue(14);
  });

  it('marca el preset Otro cuando el intervalo es un valor custom', async () => {
    renderScreen();
    await expandNextVisit();
    const diasGroup = screen.getByRole('group', { name: /Días rápido/ });
    const daysInput = screen.getByLabelText('Días') as HTMLInputElement;
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '21');
    expect(within(diasGroup).getByRole('button', { name: 'Otro' })).toHaveClass('active');
    expect(within(diasGroup).getByRole('button', { name: '7' })).not.toHaveClass('active');
  });

  it('ofrece presets de aviso (0/1/3/7) y tocar uno llena el input de lead', async () => {
    renderScreen();
    await expandNextVisit();
    const avisoGroup = screen.getByRole('group', { name: /Aviso rápido/ });
    const leadInput = screen.getByLabelText('Avisar días antes') as HTMLInputElement;
    await userEvent.click(within(avisoGroup).getByRole('button', { name: '1' }));
    expect(leadInput).toHaveValue(1);
    await userEvent.click(within(avisoGroup).getByRole('button', { name: '3' }));
    expect(leadInput).toHaveValue(3);
  });

  it('deshabilita presets de aviso mayores que el intervalo', async () => {
    renderScreen();
    await expandNextVisit();
    const avisoGroup = screen.getByRole('group', { name: /Aviso rápido/ });
    const daysInput = screen.getByLabelText('Días') as HTMLInputElement;
    const chip7 = within(avisoGroup).getByRole('button', { name: '7' });
    expect(chip7).toBeEnabled();
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '3');
    expect(chip7).toBeDisabled();
  });

  it('marca la fecha con max = hoy para que el navegador bloquee una fecha futura', () => {
    renderScreen();
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    expect(dateInput).toHaveAttribute('max', localTodayIso());
  });

  it('cancela la visita programada activa desde Registrar y vuelve al origen', async () => {
    const c = makeInMemoryContainer();
    const { visitId } = await c.scheduleVisit.execute({
      fieldId: 'f1',
      plannedFor: new Date('2026-08-10T00:00:00Z'),
      reminderLeadDays: 3,
    });
    render(
      <CampoProvider container={c}>
        <MemoryRouter
          initialEntries={[{ pathname: '/field/f1/record', state: { back: { label: 'Próximas visitas', to: '/' } } }]}
        >
          <Routes>
            <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
            <Route path="/" element={<div>Listado</div>} />
          </Routes>
        </MemoryRouter>
      </CampoProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Cancelar visita/ }));
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Listado')).toBeInTheDocument();
    expect((await c.getVisit.execute(visitId))?.status).toBe('CANCELLED');
  });

  it('no muestra el botón de cancelar cuando el lote no tiene programada activa', async () => {
    renderScreen();
    await screen.findByLabelText('Fecha');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Cancelar visita/ })).not.toBeInTheDocument(),
    );
  });

  it('muestra la próxima visita colapsada y al expandir revela los controles', async () => {
    renderScreen();
    // colapsado: el resumen está visible, los controles no
    const trigger = screen.getByRole('button', { name: /Próxima:/ });
    expect(trigger).toHaveTextContent(/14 días/);
    expect(screen.queryByLabelText('Días')).not.toBeInTheDocument();
    // expandir
    await userEvent.click(trigger);
    expect(screen.getByLabelText('Días')).toBeInTheDocument();
    expect(screen.getByLabelText('Avisar días antes')).toBeInTheDocument();
  });
});

describe('RecordVisitScreen (camino global /registrar)', () => {
  function renderGlobal(c = makeInMemoryContainer(new Date())) {
    return render(
      <CampoProvider container={c}>
        <MemoryRouter initialEntries={['/registrar']}>
          <Routes>
            <Route path="/registrar" element={<RecordVisitScreen />} />
            <Route path="/" element={<div>Listado</div>} />
          </Routes>
        </MemoryRouter>
      </CampoProvider>,
    );
  }

  it('crea lote, zona y cliente nuevos y registra la visita desde /registrar', async () => {
    const c = makeInMemoryContainer(new Date());
    await c.clearAllData.execute();
    renderGlobal(c);
    await userEvent.type(screen.getByLabelText('Lote'), 'Paso 9');
    await userEvent.type(screen.getByLabelText('Zona'), 'La Costa');
    await userEvent.type(screen.getByLabelText('Cliente'), 'Herrera');
    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    expect(await screen.findByText('Listado')).toBeInTheDocument();
    expect((await c.listZones.execute()).map((z) => z.name)).toEqual(['La Costa']);
    expect((await c.listClients.execute()).map((cl) => cl.name)).toEqual(['Herrera']);
    expect((await c.listCatalogFields.execute()).map((f) => f.field.name)).toEqual(['Paso 9']);
    expect((await c.listUpcomingVisits.execute()).map((u) => u.field.name)).not.toContain('Paso 9');
  });

  it('permite elegir un lote existente y registra para ese lote', async () => {
    const c = makeInMemoryContainer(new Date());
    renderGlobal(c);
    await userEvent.type(screen.getByLabelText('Lote'), 'Alto');
    await userEvent.click(screen.getByRole('button', { name: 'Lote El Alto' }));
    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    expect(await screen.findByText('Listado')).toBeInTheDocument();
    expect(await c.listCatalogFields.execute()).toHaveLength(2);
  });

  it('exige el nombre del lote en /registrar', async () => {
    renderGlobal();
    await expandNextVisit();
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Ingresá el nombre del lote/);
    expect(screen.queryByText('Listado')).not.toBeInTheDocument();
  });
});
