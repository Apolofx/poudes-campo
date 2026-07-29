import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { Field } from '@/domain/entities/field';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbFieldRepository(db) };
}

async function freshDb() {
  return openCampoDb(`t-${Math.random()}`);
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

  it('listAllWithHierarchy excludes archived fields and resolves names against active parents only', async () => {
    const db = await freshDb();
    await db.put('zones', { id: 'z1', name: 'Norte' });
    await db.put('zones', { id: 'z2', name: 'Sur', archived: true });
    await db.put('clients', { id: 'c1', name: 'Pérez' });
    await db.put('fields', { id: 'f1', name: 'Activo', clientId: 'c1', zoneId: 'z1' });
    await db.put('fields', { id: 'f2', name: 'Arch', clientId: 'c1', zoneId: 'z1', archived: true });
    await db.put('fields', { id: 'f3', name: 'ZonaArch', clientId: 'c1', zoneId: 'z2' });
    const repo = new IdbFieldRepository(db);
    const rows = await repo.listAllWithHierarchy();
    expect(rows.map((r) => r.field.id).sort()).toEqual(['f1', 'f3']);
    expect(rows.find((r) => r.field.id === 'f3')?.zoneName).toBeUndefined();
    expect(rows.find((r) => r.field.id === 'f1')?.zoneName).toBe('Norte');
    db.close();
  });

  it('listAllForCatalog includes archived, findActiveBy* excludes archived', async () => {
    const db = await freshDb();
    await db.put('fields', { id: 'f1', name: 'A', clientId: 'c1', zoneId: 'z1' });
    await db.put('fields', { id: 'f2', name: 'B', clientId: 'c1', zoneId: 'z1', archived: true });
    const repo = new IdbFieldRepository(db);
    expect((await repo.listAllForCatalog()).length).toBe(2);
    expect((await repo.findActiveByClientId('c1')).map((f) => f.id)).toEqual(['f1']);
    expect((await repo.findActiveByZoneId('z1')).map((f) => f.id)).toEqual(['f1']);
    db.close();
  });
});
