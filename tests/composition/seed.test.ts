import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { seedIfEmpty } from '@/composition/seed';

describe('seedIfEmpty', () => {
  it('populates zones, clients and fields on an empty db', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    expect(await db.count('fields')).toBeGreaterThan(0);
    expect(await db.count('zones')).toBeGreaterThan(0);
    expect(await db.count('clients')).toBeGreaterThan(0);
    db.close();
  });

  it('is idempotent: running twice does not duplicate', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    await seedIfEmpty(db);
    const count = await db.count('fields');
    await seedIfEmpty(db);
    expect(await db.count('fields')).toBe(count);
    db.close();
  });
});
