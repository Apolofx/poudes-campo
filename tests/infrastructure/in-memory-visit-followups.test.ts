import { describe, it, expect } from 'vitest';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { Visit } from '@/domain/entities/visit';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function pending(props: { id: string; fieldId: string; plannedFor: string }): Visit {
  return new Visit({
    id: props.id,
    fieldId: props.fieldId,
    status: 'PENDING',
    plannedFor: at(props.plannedFor),
    reminderLeadDays: 3,
    createdAt: at(props.plannedFor),
  });
}

function done(props: { id: string; fieldId: string; visitedAt: string }): Visit {
  return new Visit({
    id: props.id,
    fieldId: props.fieldId,
    status: 'DONE',
    visitedAt: at(props.visitedAt),
    createdAt: at(props.visitedAt),
  });
}

describe('InMemoryVisitRepository pending queries', () => {
  it('finds the pending visit of a field', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(done({ id: 'v1', fieldId: 'f1', visitedAt: '2026-07-10' }));
    await repo.save(pending({ id: 'p1', fieldId: 'f1', plannedFor: '2026-08-10' }));

    expect((await repo.findPendingByField('f1'))?.id).toBe('p1');
  });

  it('returns null when the field has no pending visit', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(done({ id: 'v1', fieldId: 'f1', visitedAt: '2026-07-10' }));

    expect(await repo.findPendingByField('f1')).toBeNull();
  });

  it('lists all pending visits ignoring done and cancelled ones', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(pending({ id: 'p1', fieldId: 'f1', plannedFor: '2026-08-10' }));
    await repo.save(pending({ id: 'p2', fieldId: 'f2', plannedFor: '2026-08-12' }));
    await repo.save(done({ id: 'v1', fieldId: 'f1', visitedAt: '2026-07-10' }));
    await repo.save(new Visit({
      id: 'c1', fieldId: 'f3', status: 'CANCELLED',
      cancelledAt: at('2026-07-20'), createdAt: at('2026-07-10'),
    }));

    expect((await repo.findPendings()).map((v) => v.id).sort()).toEqual(['p1', 'p2']);
  });

  it('returns [] when there are no visits', async () => {
    expect(await new InMemoryVisitRepository().findPendings()).toEqual([]);
  });
});
