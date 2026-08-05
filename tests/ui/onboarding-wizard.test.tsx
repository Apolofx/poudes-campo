import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider } from '@/ui/TenantConfigProvider';
import { OnboardingWizardScreen } from '@/ui/screens/OnboardingWizardScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

const CONFIG = { apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' };

function renderWizard(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <TenantConfigProvider>
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route path="/" element={<div>Inicio</div>} />
            <Route path="/onboarding" element={<OnboardingWizardScreen />} />
          </Routes>
        </MemoryRouter>
      </TenantConfigProvider>
    </CampoProvider>,
  );
}

async function completeStep1() {
  await screen.findByRole('heading', { name: 'Bienvenido a Campo' });
  await userEvent.type(screen.getByLabelText(/Clave de acceso/), 'tnt_t1_secret');
  await userEvent.clear(screen.getByLabelText(/URL de la API/));
  await userEvent.type(screen.getByLabelText(/URL de la API/), 'https://api.example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function completeStep2() {
  await screen.findByRole('heading', { name: 'Tu primer lote' });
  await userEvent.type(screen.getByLabelText('Lote'), 'Paso 9');
  await userEvent.type(screen.getByLabelText('Zona'), 'La Costa');
  await userEvent.type(screen.getByLabelText('Cliente'), 'Herrera');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('OnboardingWizardScreen', () => {
  it('instalación limpia: completa los 3 pasos y persiste clave + lote + visita', async () => {
    const container = makeInMemoryContainer();
    await container.clearAllData.execute();
    renderWizard(container);

    await completeStep1();
    await completeStep2();

    await screen.findByRole('heading', { name: 'Programá tu primera visita' });
    await userEvent.click(screen.getByRole('button', { name: 'Programar' }));

    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    await expect(container.getTenantConfig()).resolves.toEqual(CONFIG);
    const rows = await container.listCatalogFields.execute();
    expect(rows).toHaveLength(1);
    const upcoming = await container.listUpcomingVisits.execute();
    expect(upcoming).toHaveLength(1);
  });

  it('re-entrada con clave pero sin lotes retoma en el paso 2', async () => {
    const container = makeInMemoryContainer(undefined, CONFIG);
    await container.clearAllData.execute();
    renderWizard(container);

    await screen.findByRole('heading', { name: 'Tu primer lote' });
    expect(screen.queryByText('Bienvenido a Campo')).not.toBeInTheDocument();
  });

  it('skip del paso 3: navega a Inicio, quedan clave + lote sin visita', async () => {
    const container = makeInMemoryContainer();
    await container.clearAllData.execute();
    renderWizard(container);

    await completeStep1();
    await completeStep2();
    await screen.findByRole('heading', { name: 'Programá tu primera visita' });
    await userEvent.click(screen.getByRole('button', { name: 'Lo hago después' }));

    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    const rows = await container.listCatalogFields.execute();
    expect(rows).toHaveLength(1);
    const upcoming = await container.listUpcomingVisits.execute();
    expect(upcoming).toHaveLength(0);
  });

  it('paso 2 con lote vacío muestra error', async () => {
    const container = makeInMemoryContainer();
    await container.clearAllData.execute();
    renderWizard(container);

    await completeStep1();
    await screen.findByRole('heading', { name: 'Tu primer lote' });
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá el nombre del lote.');
  });

  it('re-entrada con clave + lote redirige a Inicio', async () => {
    renderWizard(makeInMemoryContainer(undefined, CONFIG));

    expect(await screen.findByText('Inicio')).toBeInTheDocument();
  });
});
