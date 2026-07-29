import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { Field } from '@/domain/entities/field';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbFieldRepository(db) };
}

describe('IdbFieldRepository', () => {
  it('saves and finds a field by id', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(new Field({ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }));
    const found = await repo.findById('f1');
    expect(found?.name).toBe('Lote 1');
    db.close();
  });

  it('returns null for a missing field', async () => {
    const { db, repo } = await freshRepo();
    expect(await repo.findById('nope')).toBeNull();
    db.close();
  });

  it('lists fields joined with client and zone names', async () => {
    const { db, repo } = await freshRepo();
    await db.put('zones', { id: 'z1', name: 'Norte' });
    await db.put('clients', { id: 'c1', name: 'Pérez' });
    await repo.save(new Field({ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }));
    const [r] = await repo.listAllWithHierarchy();
    expect(r.field.name).toBe('Lote 1');
    expect(r.clientName).toBe('Pérez');
    expect(r.zoneName).toBe('Norte');
    db.close();
  });

  it('uses undefined names when references are missing', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(new Field({ id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1' }));
    const [r] = await repo.listAllWithHierarchy();
    expect(r.clientName).toBeUndefined();
    expect(r.zoneName).toBeUndefined();
    db.close();
  });
});
