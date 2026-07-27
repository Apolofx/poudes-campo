import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { Visit } from '@/domain/entities/visit';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbVisitRepository(db) };
}

function visit(id: string, fieldId: string, isoDate: string, status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE') {
  return new Visit({
    id, fieldId,
    visitDate: new Date(isoDate),
    createdAt: new Date(isoDate),
    status,
  });
}

describe('IdbVisitRepository', () => {
  it('saves and finds a visit by id', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z'));
    expect((await repo.findById('v1'))?.id).toBe('v1');
    db.close();
  });

  it('finds an active visit on the same calendar day', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z'));
    const found = await repo.findActiveByFieldOnDay('f1', new Date('2026-07-20T23:00:00Z'));
    expect(found?.id).toBe('v1');
    db.close();
  });

  it('ignores cancelled visits and other days', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z', 'CANCELLED'));
    await repo.save(visit('v2', 'f1', '2026-07-21T10:00:00Z', 'ACTIVE'));
    expect(await repo.findActiveByFieldOnDay('f1', new Date('2026-07-20T12:00:00Z'))).toBeNull();
    db.close();
  });

  it('lists visits by field only', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(visit('v1', 'f1', '2026-07-20T10:00:00Z'));
    await repo.save(visit('v2', 'f2', '2026-07-20T10:00:00Z'));
    const list = await repo.listByField('f1');
    expect(list.map((v) => v.id)).toEqual(['v1']);
    db.close();
  });
});
