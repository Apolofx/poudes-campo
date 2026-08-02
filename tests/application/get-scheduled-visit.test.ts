import { describe, it, expect } from 'vitest';
import { GetScheduledVisit } from '@/application/use-cases/get-scheduled-visit';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';

describe('GetScheduledVisit', () => {
  it('returns the scheduled visit by id', async () => {
    const repo = new InMemoryScheduledVisitRepository();
    await repo.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: new Date('2026-07-31T12:00:00Z') }));
    const uc = new GetScheduledVisit(repo);
    expect((await uc.execute('s1'))?.id).toBe('s1');
    expect(await uc.execute('nope')).toBeNull();
  });
});
