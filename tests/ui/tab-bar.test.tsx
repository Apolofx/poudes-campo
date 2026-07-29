import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabBar } from '@/ui/components/TabBar';

describe('TabBar', () => {
  it('renders Inicio and Buscar links to the right routes', () => {
    render(<MemoryRouter initialEntries={['/']}><TabBar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Inicio/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Buscar/ })).toHaveAttribute('href', '/buscar');
  });

  it('marks the active route with aria-current', () => {
    render(<MemoryRouter initialEntries={['/buscar']}><TabBar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Buscar/ })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a Catálogo tab linking to /catalogo', () => {
    render(<MemoryRouter initialEntries={['/']}><TabBar /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /Catálogo/ });
    expect(link).toHaveAttribute('href', '/catalogo');
  });
});
