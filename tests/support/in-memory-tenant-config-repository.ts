import type { TenantConfig, TenantConfigRepository } from '@/domain/ports/outbound/tenant-config-repository';

export class InMemoryTenantConfigRepository implements TenantConfigRepository {
  private value: TenantConfig | null = null;

  constructor(initial: TenantConfig | null = null) {
    this.value = initial;
  }

  async get(): Promise<TenantConfig | null> {
    return this.value;
  }

  async save(config: TenantConfig): Promise<void> {
    this.value = config;
  }

  async clear(): Promise<void> {
    this.value = null;
  }
}
