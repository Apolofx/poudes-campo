import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TenantConfig } from '@/domain/ports/outbound/tenant-config-repository';
import { useCampo } from '@/ui/CampoProvider';

interface TenantConfigContextValue {
  config: TenantConfig | null;
  loading: boolean;
  save: (config: TenantConfig) => Promise<void>;
  clear: () => Promise<void>;
}

const TenantConfigContext = createContext<TenantConfigContextValue | null>(null);

export function TenantConfigProvider({ children }: { children: ReactNode }) {
  const { getTenantConfig, saveTenantConfig, clearTenantConfig } = useCampo();
  const [config, setConfig] = useState<TenantConfig | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getTenantConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, [getTenantConfig]);

  const save = useCallback(
    async (next: TenantConfig) => {
      await saveTenantConfig(next);
      setConfig(next);
    },
    [saveTenantConfig],
  );

  const clear = useCallback(async () => {
    await clearTenantConfig();
    setConfig(null);
  }, [clearTenantConfig]);

  const value = useMemo(
    () => ({ config: config ?? null, loading: config === undefined, save, clear }),
    [config, save, clear],
  );

  return <TenantConfigContext.Provider value={value}>{children}</TenantConfigContext.Provider>;
}

export function useTenantConfig(): TenantConfigContextValue {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) throw new Error('useTenantConfig must be used within a TenantConfigProvider');
  return ctx;
}
