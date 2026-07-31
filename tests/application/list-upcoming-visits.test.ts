import { describe, it, expect } from 'vitest';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
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
  const save = (id: string, fieldId: string, next?: string) =>
    visits.save(new Visit({
      id, fieldId, visitDate: at('2026-07-10'), createdAt: at('2026-07-10'),
      followUp: next ? { nextVisitDate: at(next), interval: VisitInterval.ofDays(14) } : undefined,
    }));
  return { fields, visits, save };
}

describe('ListUpcomingVisits', () => {
  it('joins hierarchy, computes urgency and sorts by daysUntil ascending', async () => {
    const { fields, visits, save } = build();
    await save('v1', 'f2', '2026-07-30'); // en 2 d
    await save('v2', 'f1', '2026-07-23'); // vencida 5 d
    await save('v3', 'f3', '2026-08-30'); // en 33 d
    const uc = new ListUpcomingVisits(fields, visits, new InMemoryScheduledVisitRepository(), new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f1', 'f2', 'f3']);
    expect(result[0].urgency.bucket).toBe('OVERDUE');
    expect(result[0].urgency.daysUntil).toBe(-5);
    expect(result[0].clientName).toBe('La Querencia');
    expect(result[0].zoneName).toBe('El Séptimo');
    expect(result[1].urgency.bucket).toBe('THIS_WEEK');
    expect(result[2].urgency.bucket).toBe('LATER');
  });

  it('excludes fields without a current follow-up', async () => {
    const { fields, visits, save } = build();
    await save('v1', 'f1', '2026-07-30');
    await save('v2', 'f2'); // sin próxima
    const uc = new ListUpcomingVisits(fields, visits, new InMemoryScheduledVisitRepository(), new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f1']);
  });

  it('returns [] when there are no upcoming visits', async () => {
    const { fields, visits } = build();
    const uc = new ListUpcomingVisits(fields, visits, new InMemoryScheduledVisitRepository(), new FixedClock(at('2026-07-28')));
    expect(await uc.execute()).toEqual([]);
  });

  it('gives precedence to an ACTIVE scheduled visit over the follow-up', async () => {
    const { fields, visits, save } = build();
    await save('v1', 'f1', '2026-08-30'); // followUp viejo, más lejano
    const scheduled = new InMemoryScheduledVisitRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-07-30'), reminderLeadDays: 3, createdAt: at('2026-07-29') }));
    await save('v2', 'f2', '2026-07-30');
    const uc = new ListUpcomingVisits(fields, visits, scheduled, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f2', 'f1']);
    const f1 = result.find((r) => r.field.id === 'f1');
    expect(f1?.nextVisitDate.toISOString()).toBe('2026-07-30T00:00:00.000Z');
    expect(f1?.urgency.daysUntil).toBe(2);
  });

  it('shows a scheduled visit for a field with no visits at all', async () => {
    const { fields, visits } = build();
    const scheduled = new InMemoryScheduledVisitRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f3', scheduledDate: at('2026-08-05'), reminderLeadDays: 3, createdAt: at('2026-07-28') }));
    const uc = new ListUpcomingVisits(fields, visits, scheduled, new FixedClock(at('2026-07-28')));

    const result = await uc.execute();

    expect(result.map((r) => r.field.id)).toEqual(['f3']);
  });
});
