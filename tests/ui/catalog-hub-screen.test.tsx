import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});