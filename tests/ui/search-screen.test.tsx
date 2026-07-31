import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CampoProvider } from '@/ui/CampoProvider';
import { SearchScreen } from '@/ui/screens/SearchScreen';
import { makeInMemoryContainer } from '../support/in-memory-container';

function renderScreen() {
  return render(
    <CampoProvider container={makeInMemoryContainer()}>
      <MemoryRouter>
        <SearchScreen />
      </MemoryRouter>
    </CampoProvider>,
  );
}

describe('SearchScreen', () => {
  it('lists all fields initially', async () => {
    renderScreen();
    expect(await screen.findByText(/Lote El Alto/)).toBeInTheDocument();
    expect(screen.getByText(/Lote La Baja/)).toBeInTheDocument();
  });

  it('filters as the user types', async () => {
    renderScreen();
    await screen.findByText(/Lote El Alto/);
    await userEvent.type(screen.getByLabelText('Buscar'), 'Alto');
    await waitFor(() => expect(screen.queryByText(/Lote La Baja/)).not.toBeInTheDocument());
    expect(screen.getByText(/Lote El Alto/)).toBeInTheDocument();
  });

  it('links each field to its history route', async () => {
    renderScreen();
    const link = await screen.findByRole('link', { name: /Lote El Alto/ });
    expect(link).toHaveAttribute('href', '/field/f1/visitas');
  });

  it('shows an empty message when a non-empty query matches nothing', async () => {
    renderScreen();
    await screen.findByText(/Lote El Alto/);
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzzznomatch');
    expect(await screen.findByText('No se encontró ningún lote.')).toBeInTheDocument();
  });

  it('does not show the empty message on initial empty query', async () => {
    renderScreen();
    await screen.findByText(/Lote El Alto/);
    expect(screen.queryByText('No se encontró ningún lote.')).not.toBeInTheDocument();
  });
});
