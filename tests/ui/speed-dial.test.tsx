import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SpeedDial } from '@/ui/components/SpeedDial';

const actions = [
  { label: 'Registrar visita', to: '/registrar', icon: <span aria-hidden="true">R</span> },
  { label: 'Programar visita', to: '/programar', icon: <span aria-hidden="true">P</span> },
];

function renderSpeedDial() {
  return render(
    <MemoryRouter>
      <SpeedDial actions={actions} ariaLabel="Acciones de visita" />
    </MemoryRouter>,
  );
}

describe('SpeedDial', () => {
  it('renderiza el FAB principal con aria-label y aria-expanded=false', () => {
    renderSpeedDial();
    const fab = screen.getByRole('button', { name: 'Acciones de visita' });
    expect(fab).toBeInTheDocument();
    expect(fab).toHaveAttribute('aria-expanded', 'false');
  });

  it('al clickear el FAB, muestra los dos actions con hrefs correctos', async () => {
    const user = userEvent.setup();
    renderSpeedDial();
    const fab = screen.getByRole('button', { name: 'Acciones de visita' });
    await user.click(fab);

    expect(fab).toHaveAttribute('aria-expanded', 'true');

    const register = screen.getByRole('link', { name: 'Registrar visita' });
    expect(register).toHaveAttribute('href', '/registrar');

    const schedule = screen.getByRole('link', { name: 'Programar visita' });
    expect(schedule).toHaveAttribute('href', '/programar');
  });

  it('al clickear fuera (backdrop), el menú se cierra', async () => {
    const user = userEvent.setup();
    renderSpeedDial();
    const fab = screen.getByRole('button', { name: 'Acciones de visita' });

    await user.click(fab);
    expect(fab).toHaveAttribute('aria-expanded', 'true');

    // Click en el backdrop (el div overlay)
    const backdrop = document.querySelector('.speed-dial-backdrop') as HTMLElement;
    await user.click(backdrop);

    expect(fab).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Registrar visita' })).not.toBeInTheDocument();
  });

  it('al tocar Escape, el menú se cierra', async () => {
    const user = userEvent.setup();
    renderSpeedDial();
    const fab = screen.getByRole('button', { name: 'Acciones de visita' });

    await user.click(fab);
    expect(fab).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(fab).toHaveAttribute('aria-expanded', 'false');
  });

  it('al clickear un action, navega y cierra el menú', async () => {
    const user = userEvent.setup();
    renderSpeedDial();
    const fab = screen.getByRole('button', { name: 'Acciones de visita' });

    await user.click(fab);
    const register = screen.getByRole('link', { name: 'Registrar visita' });
    await user.click(register);

    // Después de navegar, el menú se cierra
    expect(fab).toHaveAttribute('aria-expanded', 'false');
  });

  it('los actions no están en el DOM cuando el menú está cerrado', () => {
    renderSpeedDial();
    expect(screen.queryByRole('link', { name: 'Registrar visita' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Programar visita' })).not.toBeInTheDocument();
  });
});
