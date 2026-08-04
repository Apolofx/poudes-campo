import type { TenantConfig, TenantConfigRepository } from '@/domain/ports/outbound/tenant-config-repository';

const STORAGE_KEY = 'campo.tenantConfig';

export class LocalTenantConfigRepository implements TenantConfigRepository {
  async get(): Promise<TenantConfig | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TenantConfig;
    } catch {
      return null;
    }
  }

  async save(config: TenantConfig): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
}
