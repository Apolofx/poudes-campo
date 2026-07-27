import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { Reminder } from '@/domain/entities/reminder';

async function freshRepo() {
  const db = await openCampoDb(`t-${Math.random()}`);
  return { db, repo: new IdbReminderRepository(db) };
}

function reminder(id: string, fieldId: string, status: 'PENDING' | 'SENT' | 'CANCELLED') {
  return new Reminder({
    id, visitId: `visit-${id}`, fieldId,
    remindAt: new Date('2026-07-31T10:00:00Z'), status,
  });
}

describe('IdbReminderRepository', () => {
  it('returns only PENDING reminders for the field', async () => {
    const { db, repo } = await freshRepo();
    await repo.save(reminder('r1', 'f1', 'PENDING'));
    await repo.save(reminder('r2', 'f1', 'CANCELLED'));
    await repo.save(reminder('r3', 'f2', 'PENDING'));
    const pending = await repo.findPendingByField('f1');
    expect(pending.map((r) => r.id)).toEqual(['r1']);
    db.close();
  });

  it('reflects an updated (cancelled) reminder', async () => {
    const { db, repo } = await freshRepo();
    const r = reminder('r1', 'f1', 'PENDING');
    await repo.save(r);
    r.cancel();
    await repo.save(r);
    expect(await repo.findPendingByField('f1')).toEqual([]);
    db.close();
  });
});
