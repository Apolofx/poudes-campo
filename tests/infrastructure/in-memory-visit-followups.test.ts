// tests/infrastructure/in-memory-visit-followups.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { Visit } from '@/domain/entities/visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function visit(props: {
  id: string; fieldId: string; createdAt: string;
  next?: string; status?: 'ACTIVE' | 'CANCELLED';
}): Visit {
  return new Visit({
    id: props.id,
    fieldId: props.fieldId,
    visitDate: at(props.createdAt),
    createdAt: at(props.createdAt),
    followUp: props.next
      ? { nextVisitDate: at(props.next), interval: VisitInterval.ofDays(14) }
      : undefined,
    status: props.status ?? 'ACTIVE',
  });
}

describe('InMemoryVisitRepository.findCurrentFollowUps', () => {
  it('returns the follow-up of the latest active visit per field', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-24' }));

    const result = await repo.findCurrentFollowUps();

    expect(result).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-24') }]);
  });

  it('omits a field whose latest active visit has no follow-up', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10' })); // sin próxima

    expect(await repo.findCurrentFollowUps()).toEqual([]);
  });

  it('ignores cancelled visits when choosing the latest', async () => {
    const repo = new InMemoryVisitRepository();
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-30', status: 'CANCELLED' }));

    expect(await repo.findCurrentFollowUps()).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-15') }]);
  });

  it('returns [] when there are no visits', async () => {
    expect(await new InMemoryVisitRepository().findCurrentFollowUps()).toEqual([]);
  });
});
