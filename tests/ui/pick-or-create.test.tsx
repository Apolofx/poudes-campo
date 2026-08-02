import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PickOrCreate, normalizeName } from '@/ui/components/PickOrCreate';

const ITEMS = [
  { id: 'z1', name: 'Norte' },
  { id: 'z2', name: 'La Costa' },
  { id: 'z3', name: 'Nueva 4' },
];

describe('normalizeName', () => {
  it('es case y accent insensitive', () => {
    expect(normalizeName('  LOS TÓLDOS ')).toBe('los toldos');
  });
});

describe('PickOrCreate', () => {
  it('filtra los items mientras se escribe', async () => {
    const user = userEvent.setup();
    render(<PickOrCreate label="Zona" items={ITEMS} placeholder="Elegí o creá" onChange={() => {}} />);
    await user.type(screen.getByLabelText('Zona'), 'n');
    expect(screen.getByRole('button', { name: 'Norte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva 4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'La Costa' })).not.toBeInTheDocument();
  });

  it('ofrece "Crear «X»" cuando el texto no matchea exactamente ningún item', async () => {
    const user = userEvent.setup();
    render(<PickOrCreate label="Zona" items={ITEMS} placeholder="Elegí o creá" onChange={() => {}} />);
    await user.type(screen.getByLabelText('Zona'), 'El Oeste');
    expect(screen.getByRole('button', { name: 'Crear «El Oeste»' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Norte' })).not.toBeInTheDocument();
  });

  it('reporta un match exacto como existente y oculta "Crear «X»"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickOrCreate label="Zona" items={ITEMS} placeholder="Elegí o creá" onChange={onChange} />);
    await user.type(screen.getByLabelText('Zona'), 'norte');
    expect(onChange).toHaveBeenLastCalledWith({ type: 'existing', id: 'z1' });
    expect(screen.queryByRole('button', { name: 'Crear «norte»' })).not.toBeInTheDocument();
  });

  it('reporta un texto sin match como creación', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickOrCreate label="Zona" items={ITEMS} placeholder="Elegí o creá" onChange={onChange} />);
    await user.type(screen.getByLabelText('Zona'), 'El Oeste');
    expect(onChange).toHaveBeenLastCalledWith({ type: 'create', name: 'El Oeste' });
  });

  it('al elegir un item existente rellena el input y reporta existing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickOrCreate label="Zona" items={ITEMS} placeholder="Elegí o creá" onChange={onChange} />);
    await user.type(screen.getByLabelText('Zona'), 'la');
    await user.click(screen.getByRole('button', { name: 'La Costa' }));
    expect(onChange).toHaveBeenLastCalledWith({ type: 'existing', id: 'z2' });
    expect(screen.getByLabelText('Zona')).toHaveValue('La Costa');
  });

  it('permite deseleccionar con "Sin zona" cuando allowNone', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PickOrCreate label="Zona" items={ITEMS} placeholder="Elegí o creá" allowNone noneLabel="Sin zona" onChange={onChange} />,
    );
    await user.type(screen.getByLabelText('Zona'), 'no');
    await user.click(screen.getByRole('button', { name: 'Sin zona' }));
    expect(onChange).toHaveBeenLastCalledWith({ type: 'none' });
    expect(screen.getByLabelText('Zona')).toHaveValue('');
  });
});
