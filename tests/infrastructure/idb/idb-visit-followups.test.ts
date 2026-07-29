import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
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

describe('IdbVisitRepository.findCurrentFollowUps', () => {
  it('returns latest active follow-up per field and skips fields closed without a follow-up', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const repo = new IdbVisitRepository(db);
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-24' }));
    await repo.save(visit({ id: 'v3', fieldId: 'f2', createdAt: '2026-07-05', next: '2026-07-20' }));
    await repo.save(visit({ id: 'v4', fieldId: 'f2', createdAt: '2026-07-11' })); // f2 cerrado sin próxima

    const result = await repo.findCurrentFollowUps();

    expect(result).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-24') }]);
    db.close();
  });

  it('ignores cancelled visits', async () => {
    const db = await openCampoDb(`t-${Math.random()}`);
    const repo = new IdbVisitRepository(db);
    await repo.save(visit({ id: 'v1', fieldId: 'f1', createdAt: '2026-07-01', next: '2026-07-15' }));
    await repo.save(visit({ id: 'v2', fieldId: 'f1', createdAt: '2026-07-10', next: '2026-07-30', status: 'CANCELLED' }));

    expect(await repo.findCurrentFollowUps()).toEqual([{ fieldId: 'f1', nextVisitDate: at('2026-07-15') }]);
    db.close();
  });
});
