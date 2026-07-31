import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbScheduledVisitRepository } from '@/infrastructure/persistence/idb/idb-scheduled-visit-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbScheduledVisitRepository(db) };
}

function scheduledVisit(id: string, fieldId: string, isoDate: string, status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE') {
  return new ScheduledVisit({
    id,
    fieldId,
    scheduledDate: new Date(isoDate),
    reminderLeadDays: 3,
    createdAt: new Date('2026-07-31T12:00:00Z'),
    status,
  });
}

describe('IdbScheduledVisitRepository', () => {
  it('saves and finds a scheduled visit by id', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(scheduledVisit('s1', 'f1', '2026-08-10T00:00:00Z'));
    expect((await repo.findById('s1'))?.id).toBe('s1');
    db.close();
  });

  it('lists scheduled visits by field only', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(scheduledVisit('s1', 'f1', '2026-08-10T00:00:00Z'));
    await repo.save(scheduledVisit('s2', 'f2', '2026-08-10T00:00:00Z'));
    const list = await repo.listByField('f1');
    expect(list.map((s) => s.id)).toEqual(['s1']);
    db.close();
  });

  it('finds only the ACTIVE scheduled visit for a field', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(scheduledVisit('s1', 'f1', '2026-08-10T00:00:00Z', 'CANCELLED'));
    await repo.save(scheduledVisit('s2', 'f1', '2026-08-20T00:00:00Z'));
    expect((await repo.findActiveByField('f1'))?.id).toBe('s2');
    db.close();
  });

  it('lists only ACTIVE scheduled visits', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(scheduledVisit('s1', 'f1', '2026-08-10T00:00:00Z', 'CANCELLED'));
    await repo.save(scheduledVisit('s2', 'f1', '2026-08-20T00:00:00Z'));
    const list = await repo.listActive();
    expect(list.map((s) => s.id)).toEqual(['s2']);
    db.close();
  });
});
