import { describe, it, expect } from 'vitest';
import { GetFieldHistory } from '@/application/use-cases/get-field-history';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';

function setup() {
  const zones = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const visits = new InMemoryVisitRepository();
  return { uc: new GetFieldHistory(fields, visits), visits };
}

const D = (iso: string) => new Date(iso);
const visitOn = (id: string, iso: string) =>
  new Visit({ id, fieldId: 'f1', visitDate: D(iso), createdAt: D(iso) });

describe('GetFieldHistory', () => {
  it('resolves the field label and returns visits newest-first', async () => {
    const { uc, visits } = setup();
    await visits.save(visitOn('v1', '2026-07-20T10:00:00Z'));
    await visits.save(visitOn('v2', '2026-07-27T10:00:00Z'));
    const view = await uc.execute('f1');
    expect(view?.field.name).toBe('El Alto');
    expect(view?.clientName).toBe('Pérez');
    expect(view?.zoneName).toBe('Norte');
    expect(view?.visits.map((v) => v.id)).toEqual(['v2', 'v1']);
  });

  it('includes cancelled visits in the history', async () => {
    const { uc, visits } = setup();
    await visits.save(new Visit({ id: 'v1', fieldId: 'f1', visitDate: D('2026-07-20T10:00:00Z'), createdAt: D('2026-07-20T10:00:00Z'), status: 'CANCELLED', cancelledAt: D('2026-07-21T10:00:00Z') }));
    const view = await uc.execute('f1');
    expect(view?.visits).toHaveLength(1);
    expect(view?.visits[0].status).toBe('CANCELLED');
  });

  it('returns null for an unknown field', async () => {
    const { uc } = setup();
    expect(await uc.execute('nope')).toBeNull();
  });
});
