import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateBanner } from '@/ui/components/UpdateBanner';

let listeners: Record<string, Set<EventListener>>;

function fireControllerChange() {
  const event = new Event('controllerchange');
  (navigator.serviceWorker as unknown as EventTarget).dispatchEvent(event);
}

describe('UpdateBanner', () => {
  beforeEach(() => {
    listeners = {};
    vi.stubGlobal('navigator', {
      serviceWorker: {
        addEventListener: vi.fn((type: string, cb: EventListener) => {
          (listeners[type] ??= new Set()).add(cb);
        }),
        removeEventListener: vi.fn((type: string, cb: EventListener) => {
          listeners[type]?.delete(cb);
        }),
        dispatchEvent: vi.fn((e: Event) => {
          listeners[e.type]?.forEach((cb) => cb(e));
        }),
      },
    });
    vi.stubGlobal('__APP_VERSION__', '1.2.3');
    vi.stubGlobal('__CHANGELOG__', {
      version: '1.2.3',
      entries: ['feat(ui): speed dial en Inicio', 'fix(ui): borde del FAB'],
    });
  });

  it('no renderiza nada cuando no hay update', () => {
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra versión y changelog cuando se dispara controllerchange', async () => {
    const user = userEvent.setup();
    render(<UpdateBanner />);

    expect(screen.queryByText(/1\.2\.3/)).not.toBeInTheDocument();

    fireControllerChange();

    expect(await screen.findByText(/1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByText('feat(ui): speed dial en Inicio')).toBeInTheDocument();
    expect(screen.getByText('fix(ui): borde del FAB')).toBeInTheDocument();
  });

  it('se puede cerrar con el botón X', async () => {
    const user = userEvent.setup();
    render(<UpdateBanner />);

    fireControllerChange();
    await screen.findByText(/1\.2\.3/);

    const close = screen.getByRole('button', { name: /cerrar/i });
    await user.click(close);

    expect(screen.queryByText(/1\.2\.3/)).not.toBeInTheDocument();
  });
});
