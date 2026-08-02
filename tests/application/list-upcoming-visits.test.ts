import { describe, it, expect } from 'vitest';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { FixedClock } from '../support/fixed-clock';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function build() {
  const zones = new Map([['z1', new Zone('z1', 'El Séptimo')], ['z2', new Zone('z2', 'La Costa')]]);
  const clients = new Map([['c1', new Client('c1', 'La Querencia')], ['c2', new Client('c2', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Cañada', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f3', name: 'Potrero 4', clientId: 'c2', zoneId: 'z2' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const save = (id: string, fieldId: string, plannedFor?: string) =>
    visits.save(new Visit({
      id, fieldId, status: 'PENDING',
      plannedFor: plannedFor ? at(plannedFor) : at('2026-08-10'),
      reminderLeadDays: 3, createdAt: at('2026-07-10'),
    }));
  return { fields, visits, save };
}

describe('ListUpcomingVisits', () => {
  it('joins hierarchy, computes urgency and sorts by daysUntil ascending', async () => {
    const { fields, visits, save } = build();
    await save('p1', 'f2', '2026-07-30'); // en 2 d
    await save('p2', 'f1', '2026-07-23'); // vencida 5 d
    await save('p3', 'f3', '2026-08-30'); // en 33 d
    const uc = new ListUpcomingVisits(fields, visits, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f1', 'f2', 'f3']);
    expect(result[0].urgency.bucket).toBe('OVERDUE');
    expect(result[0].urgency.daysUntil).toBe(-5);
    expect(result[0].clientName).toBe('La Querencia');
    expect(result[0].zoneName).toBe('El Séptimo');
    expect(result[1].urgency.bucket).toBe('THIS_WEEK');
    expect(result[2].urgency.bucket).toBe('LATER');
  });

  it('excludes fields without a pending visit', async () => {
    const { fields, visits, save } = build();
    await save('p1', 'f1', '2026-07-30');
    const uc = new ListUpcomingVisits(fields, visits, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f1']);
  });

  it('returns [] when there are no upcoming visits', async () => {
    const { fields, visits } = build();
    const uc = new ListUpcomingVisits(fields, visits, new FixedClock(at('2026-07-28')));
    expect(await uc.execute()).toEqual([]);
  });

  it('shows one row per field with a pending visit, ignoring done ones', async () => {
    const { fields, visits, save } = build();
    await save('p1', 'f1', '2026-07-30');
    await visits.save(new Visit({
      id: 'v1', fieldId: 'f2', status: 'DONE',
      visitedAt: at('2026-07-20'), createdAt: at('2026-07-20'),
    }));
    const uc = new ListUpcomingVisits(fields, visits, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f1']);
    expect(result[0].nextVisitDate.toISOString()).toBe('2026-07-30T00:00:00.000Z');
  });
});
