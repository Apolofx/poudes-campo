export interface TenantConfig {
  apiUrl: string;
  apiKey: string;
}

export interface TenantConfigRepository {
  get(): Promise<TenantConfig | null>;
  save(config: TenantConfig): Promise<void>;
  clear(): Promise<void>;
}
