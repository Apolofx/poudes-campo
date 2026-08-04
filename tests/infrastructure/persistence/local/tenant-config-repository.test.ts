// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalTenantConfigRepository } from '@/infrastructure/persistence/local/tenant-config-repository';

const STORAGE_KEY = 'campo.tenantConfig';

describe('LocalTenantConfigRepository', () => {
  let repo: LocalTenantConfigRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalTenantConfigRepository();
  });

  it('sin dato devuelve null', async () => {
    await expect(repo.get()).resolves.toBeNull();
  });

  it('save() persiste y get() lo devuelve', async () => {
    const config = { apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' };

    await repo.save(config);

    await expect(repo.get()).resolves.toEqual(config);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(config);
  });

  it('clear() borra el config', async () => {
    await repo.save({ apiUrl: 'https://api.example.com', apiKey: 'tnt_t1_secret' });

    await repo.clear();

    await expect(repo.get()).resolves.toBeNull();
  });

  it('JSON corrupto devuelve null', async () => {
    localStorage.setItem(STORAGE_KEY, '{oops');

    await expect(repo.get()).resolves.toBeNull();
  });
});
