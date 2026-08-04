import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { CampoProvider } from '@/ui/CampoProvider';
import { TenantConfigProvider, useTenantConfig } from '@/ui/TenantConfigProvider';
import { makeInMemoryContainer } from '../support/in-memory-container';

const wrapper = ({ children }: { children: ReactNode }) => (
  <CampoProvider container={makeInMemoryContainer()}>
    <TenantConfigProvider>{children}</TenantConfigProvider>
  </CampoProvider>
);

describe('useTenantConfig', () => {
  it('arranca en loading y termina con config null sin dato guardado', async () => {
    const { result } = renderHook(() => useTenantConfig(), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toBeNull();
  });

  it('save() expone el config y lo persiste en el repo', async () => {
    const container = makeInMemoryContainer();
    const { result } = renderHook(
      () => useTenantConfig(),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <CampoProvider container={container}>
            <TenantConfigProvider>{children}</TenantConfigProvider>
          </CampoProvider>
        ),
      },
    );

    await act(async () => {
      await result.current.save({ apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' });
    });

    await waitFor(() => expect(result.current.config).toEqual({ apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' }));
    await expect(container.getTenantConfig()).resolves.toEqual({ apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' });
  });
});
