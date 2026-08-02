import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { Visit } from '@/domain/entities/visit';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbVisitRepository(db) };
}

function doneVisit(id: string, fieldId: string, isoDate: string) {
  return new Visit({
    id, fieldId,
    status: 'DONE',
    visitedAt: new Date(isoDate),
    createdAt: new Date(isoDate),
  });
}

function pendingVisit(id: string, fieldId: string, plannedForIso: string) {
  return new Visit({
    id, fieldId,
    status: 'PENDING',
    plannedFor: new Date(plannedForIso),
    reminderLeadDays: 3,
    createdAt: new Date(plannedForIso),
  });
}

function cancelledVisit(id: string, fieldId: string, cancelledAtIso: string) {
  return new Visit({
    id, fieldId,
    status: 'CANCELLED',
    cancelledAt: new Date(cancelledAtIso),
    createdAt: new Date(cancelledAtIso),
  });
}

describe('IdbVisitRepository', () => {
  it('saves and finds a visit by id', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(doneVisit('v1', 'f1', '2026-07-20T10:00:00Z'));
    expect((await repo.findById('v1'))?.id).toBe('v1');
    db.close();
  });

  it('finds a done visit on the same calendar day', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(doneVisit('v1', 'f1', '2026-07-20T10:00:00Z'));
    const found = await repo.findDoneByFieldOnDay('f1', new Date('2026-07-20T23:00:00Z'));
    expect(found?.id).toBe('v1');
    db.close();
  });

  it('ignores pending, cancelled visits and other days', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(pendingVisit('p1', 'f1', '2026-07-20T10:00:00Z'));
    await repo.save(cancelledVisit('c1', 'f1', '2026-07-20T10:00:00Z'));
    await repo.save(doneVisit('v1', 'f1', '2026-07-21T10:00:00Z'));
    expect(await repo.findDoneByFieldOnDay('f1', new Date('2026-07-20T12:00:00Z'))).toBeNull();
    db.close();
  });

  it('finds the pending visit of a field and null when there is none', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(pendingVisit('p1', 'f1', '2026-08-10T00:00:00Z'));
    await repo.save(doneVisit('v1', 'f1', '2026-07-20T10:00:00Z'));
    expect((await repo.findPendingByField('f1'))?.id).toBe('p1');
    expect(await repo.findPendingByField('f2')).toBeNull();
    db.close();
  });

  it('lists all pending visits across fields', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(pendingVisit('p1', 'f1', '2026-08-10T00:00:00Z'));
    await repo.save(pendingVisit('p2', 'f2', '2026-08-12T00:00:00Z'));
    await repo.save(doneVisit('v1', 'f1', '2026-07-20T10:00:00Z'));
    expect((await repo.findPendings()).map((v) => v.id).sort()).toEqual(['p1', 'p2']);
    db.close();
  });

  it('lists visits by field only', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(doneVisit('v1', 'f1', '2026-07-20T10:00:00Z'));
    await repo.save(doneVisit('v2', 'f2', '2026-07-20T10:00:00Z'));
    const list = await repo.listByField('f1');
    expect(list.map((v) => v.id)).toEqual(['v1']);
    db.close();
  });
});
