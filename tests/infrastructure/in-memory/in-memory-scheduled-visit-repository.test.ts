import { describe, it, expect } from 'vitest';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';

const base = {
  id: 's1',
  fieldId: 'f1',
  scheduledDate: new Date('2026-08-10T00:00:00Z'),
  reminderLeadDays: 3,
  createdAt: new Date('2026-07-31T12:00:00Z'),
};

describe('InMemoryScheduledVisitRepository', () => {
  it('implements the full contract', async () => {
    const repo = new InMemoryScheduledVisitRepository();
    await repo.save(new ScheduledVisit({ ...base }));
    await repo.save(new ScheduledVisit({ ...base, id: 's2', status: 'CANCELLED', cancelledAt: base.createdAt }));

    expect((await repo.findById('s1'))?.id).toBe('s1');
    expect(await repo.findById('nope')).toBeNull();
    expect((await repo.listByField('f1')).map((s) => s.id).sort()).toEqual(['s1', 's2']);
    expect((await repo.findActiveByField('f1'))?.id).toBe('s1');
    expect((await repo.listActive()).map((s) => s.id)).toEqual(['s1']);
    repo.clear();
    expect(await repo.listActive()).toEqual([]);
  });
});
