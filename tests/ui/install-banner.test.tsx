import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallBanner } from '@/ui/components/InstallBanner';

const originalUserAgent = navigator.userAgent;

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', {
    value: originalUserAgent,
    configurable: true,
  });
});

function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome }) },
  });
  window.dispatchEvent(event);
  return prompt;
}

function setIOSUserAgent() {
  Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', configurable: true });
}

describe('InstallBanner', () => {
  it('no renderiza nada sin beforeinstallprompt ni iOS', () => {
    render(<InstallBanner />);
    expect(screen.queryByText(/instalar/i)).not.toBeInTheDocument();
  });

  it('ofrece el botón Instalar cuando el navegador dispara beforeinstallprompt', async () => {
    render(<InstallBanner />);
    dispatchInstallPrompt();
    expect(await screen.findByRole('button', { name: 'Instalar' })).toBeInTheDocument();
  });

  it('instala al tocar Instalar: llama prompt() y oculta el banner', async () => {
    render(<InstallBanner />);
    const prompt = dispatchInstallPrompt();
    await screen.findByRole('button', { name: 'Instalar' });

    await userEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/instalar/i)).not.toBeInTheDocument());
  });

  it('oculta el banner si el usuario descarta el prompt nativo', async () => {
    render(<InstallBanner />);
    dispatchInstallPrompt('dismissed');
    await screen.findByRole('button', { name: 'Instalar' });

    await userEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    await waitFor(() => expect(screen.queryByText(/instalar/i)).not.toBeInTheDocument());
  });

  it('se oculta al tocar Cerrar', async () => {
    render(<InstallBanner />);
    dispatchInstallPrompt();
    await screen.findByRole('button', { name: 'Instalar' });

    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(screen.queryByText(/instalar/i)).not.toBeInTheDocument();
  });

  it('en iOS muestra las instrucciones de Agregar a Inicio', () => {
    setIOSUserAgent();
    render(<InstallBanner />);
    expect(screen.getByText(/Agregar a Inicio/)).toBeInTheDocument();
  });
});
