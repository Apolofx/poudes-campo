import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Título" message="Mensaje" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders title, message and actions when open', () => {
    render(
      <ConfirmDialog open title="Cancelar visita" message="¿Confirmás?" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole('dialog', { name: 'Cancelar visita' })).toBeInTheDocument();
    expect(screen.getByText('¿Confirmás?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });

  it('focuses the first (less destructive) button when it opens', () => {
    render(
      <ConfirmDialog open title="Título" message="Mensaje" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('closes with Escape without confirming', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="Título" message="Mensaje" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
