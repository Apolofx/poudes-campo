import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
import { FlagsProvider, type FlagValues } from '@/ui/FlagsProvider';
import { App } from '@/ui/App';

async function renderApp(
  container: ReturnType<typeof buildContainer>,
  initialEntries: string[],
  flags: FlagValues = {},
  seedConfig = true,
) {
  if (seedConfig) {
    await container.saveTenantConfig({ apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' });
  }
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <FlagsProvider initialFlags={flags}>
          <MemoryRouter initialEntries={initialEntries}>
            <App />
          </MemoryRouter>
        </FlagsProvider>
      </TenantConfigProvider>
    </CampoProvider>,
  );
}

function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('search → record visit (real IndexedDB adapter)', () => {
  it('records a visit for a seeded field and returns to the list', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const container = buildContainer(db);

    await renderApp(container, ['/buscar']);

    // Buscar y abrir el historial del primer lote sembrado.
    const link = await screen.findByRole('link', { name: /^El Alto(?!\s*2)/ });
    await userEvent.click(link);

    // Desde el historial, ir a registrar visita (campo sin visitas: CTA del empty state).
    const recordLink = await screen.findByRole('link', { name: /Registrar visita/ });
    await userEvent.click(recordLink);

    // Registrar sin próxima visita.
    await screen.findByRole('heading', { name: 'Registrar visita' });
    await userEvent.click(screen.getByRole('button', { name: /Próxima|Programar próxima/ }));
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    // Aterriza en Inicio y la visita quedó persistida.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Próximas visitas' })).toBeInTheDocument());
    await waitFor(async () => expect(await db.count('visits')).toBe(1));
    db.close();
  });

  it('primer uso: crea lote, zona y cliente y agenda la primera visita desde Inicio', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const container = buildContainer(db);

    await renderApp(container, ['/']);

    // Inicio vacío → FAB "Programar visita".
    await screen.findByText('No hay visitas agendadas.');
    await userEvent.click(screen.getAllByRole('link', { name: /Programar visita/ })[0]);

    // El camino único crea todo de paso.
    await screen.findByRole('heading', { name: 'Programar visita' });
    await userEvent.type(screen.getByLabelText('Lote'), 'Paso 9');
    await userEvent.type(screen.getByLabelText('Zona'), 'La Costa');
    await userEvent.type(screen.getByLabelText('Cliente'), 'Herrera');
    const dateInput = screen.getByLabelText('Fecha') as HTMLInputElement;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, isoInDays(3));
    await userEvent.click(screen.getByRole('button', { name: /Programar/ }));

    // Aterriza en Inicio con la visita en la agenda.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Próximas visitas' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('link', { name: /Paso 9/ })).toBeInTheDocument());

    await waitFor(async () => expect(await db.count('zones')).toBe(1));
    expect(await db.count('clients')).toBe(1);
    expect(await db.count('fields')).toBe(1);
    expect(await db.count('visits')).toBe(1);
    expect(await db.count('reminders')).toBe(1);
    db.close();
  });

  it('primer uso vía wizard: completa los 3 pasos sobre IndexedDB real', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const container = buildContainer(db);
    await container.clearTenantConfig();

    await renderApp(container, ['/onboarding'], { onboardingNuevo: true }, false);

    await screen.findByRole('heading', { name: 'Bienvenido a Campo' });
    await userEvent.type(screen.getByLabelText(/Clave de acceso/), 'tnt_t1_secret');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await screen.findByRole('heading', { name: 'Tu primer lote' });
    await userEvent.type(screen.getByLabelText('Lote'), 'Paso 9');
    await userEvent.type(screen.getByLabelText('Zona'), 'La Costa');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await screen.findByRole('heading', { name: 'Programá tu primera visita' });
    await userEvent.click(screen.getByRole('button', { name: 'Programar y listo' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Próximas visitas' })).toBeInTheDocument());
    await waitFor(async () => expect(await db.count('visits')).toBe(1));
    expect(await db.count('fields')).toBe(1);
    expect(await db.count('zones')).toBe(1);
    db.close();
  });
});
