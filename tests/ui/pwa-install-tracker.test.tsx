import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { pageview } from '@vercel/analytics';
import { PwaInstallTracker } from '@/ui/components/PwaInstallTracker';

vi.mock('@vercel/analytics', () => ({
  pageview: vi.fn(),
}));

describe('PwaInstallTracker', () => {
  beforeEach(() => {
    vi.mocked(pageview).mockClear();
  });

  it('registra un pageview virtual cuando el usuario instala la app', () => {
    render(<PwaInstallTracker />);

    window.dispatchEvent(new Event('appinstalled'));

    expect(pageview).toHaveBeenCalledWith({ path: '/__app-installed__' });
  });

  it('no registra nada sin el evento appinstalled', () => {
    render(<PwaInstallTracker />);
    expect(pageview).not.toHaveBeenCalled();
  });
});
