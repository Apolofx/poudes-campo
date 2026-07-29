import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { CatalogHubScreen } from '@/ui/screens/CatalogHubScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderHub(container = makeInMemoryContainer()) {
  render(
    <CampoProvider container={container}>
      <MemoryRouter><CatalogHubScreen /></MemoryRouter>
    </CampoProvider>,
  );
  return container;
}

describe('CatalogHubScreen', () => {
  it('links to zonas, clientes and lotes', () => {
    renderHub();
    expect(screen.getByRole('link', { name: /Zonas/ })).toHaveAttribute('href', '/catalogo/zonas');
    expect(screen.getByRole('link', { name: /Clientes/ })).toHaveAttribute('href', '/catalogo/clientes');
    expect(screen.getByRole('link', { name: /Lotes/ })).toHaveAttribute('href', '/catalogo/lotes');
  });

  it('clears all data after a two-step confirmation', async () => {
    const container = renderHub();
    await userEvent.click(screen.getByRole('button', { name: /Borrar todos los datos/ }));
    // paso 2: confirmar en el diálogo
    await userEvent.click(screen.getByRole('button', { name: /^Borrar$/ }));
    // los lotes del fixture in-memory quedaron vacíos
    expect((await container.listCatalogFields.execute()).length).toBe(0);
  });
});
