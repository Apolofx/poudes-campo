import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';
import { buildContainer } from '@/composition/container';
import { CampoProvider } from '@/ui/CampoProvider';
import { App } from '@/ui/App';

describe('search → record visit (real IndexedDB adapter)', () => {
  it('records a visit for a seeded field and returns to the list', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const container = buildContainer(db);

    render(
      <CampoProvider container={container}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </CampoProvider>,
    );

    // Buscar y abrir el primer lote sembrado.
    const link = await screen.findByRole('link', { name: /^El Alto(?!\s*2)/ });
    await userEvent.click(link);

    // Registrar sin próxima visita.
    await screen.findByRole('heading', { name: 'Registrar visita' });
    await userEvent.click(screen.getByLabelText(/Sin próxima/));
    await userEvent.click(screen.getByRole('button', { name: /Registrar/ }));

    // Vuelve a la búsqueda y hay una visita persistida.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Buscar lote' })).toBeInTheDocument());
    await waitFor(async () => expect(await db.count('visits')).toBe(1));
    db.close();
  });
});
