import { describe, it, expect } from 'vitest';
import { RecordVisitEnsuringField } from '@/application/use-cases/record-visit-ensuring-field';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { CreateZone, ListZones } from '@/application/use-cases/zone-catalog';
import { CreateClient, ListClients } from '@/application/use-cases/client-catalog';
import { CreateField, ListCatalogFields } from '@/application/use-cases/field-catalog';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { FieldNotFound, FutureVisitDate } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

const now = new Date('2026-07-31T12:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function build() {
  const zoneMap = new Map<string, Zone>();
  const clientMap = new Map<string, Client>();
  const fields = new InMemoryFieldRepository(zoneMap, clientMap, []);
  const zones = new InMemoryZoneRepository(zoneMap);
  const clients = new InMemoryClientRepository(clientMap);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const ids = new IncrementingIdGenerator();
  const createZone = new CreateZone(zones, ids);
  const createClient = new CreateClient(clients, ids);
  const createField = new CreateField(fields, ids);
  const recordVisit = new RecordVisit(fields, visits, reminders, new FixedClock(now), ids);
  const uc = new RecordVisitEnsuringField(createZone, createClient, createField, recordVisit);
  return {
    uc,
    zones,
    clients,
    fields,
    visits,
    reminders,
    createZone,
    createClient,
    createField,
  };
}

describe('RecordVisitEnsuringField', () => {
  it('creates zone, client and field from names and records the visit', async () => {
    const { uc, zones, clients, fields, visits } = build();

    const result = await uc.execute({
      visitedAt: at('2026-07-30'),
      notes: 'primera',
      field: { name: 'Paso 9', zone: { name: 'La Costa' }, client: { name: 'Herrera' } },
    });

    expect(await zones.listAll()).toHaveLength(1);
    expect((await zones.listAll())[0].name).toBe('La Costa');
    expect(await clients.listAll()).toHaveLength(1);
    expect((await clients.listAll())[0].name).toBe('Herrera');
    const field = await fields.findById(result.fieldId);
    expect(field?.name).toBe('Paso 9');
    expect(field?.zoneId).toBe((await zones.listAll())[0].id);
    expect(field?.clientId).toBe((await clients.listAll())[0].id);

    const done = await visits.findDoneByFieldOnDay(result.fieldId, at('2026-07-30'));
    expect(done?.notes).toBe('primera');
    expect(done?.id).toBe(result.visitId);
  });

  it('creates a field without zone or client when refs are omitted', async () => {
    const { uc, zones, clients, fields } = build();

    const result = await uc.execute({
      visitedAt: at('2026-07-30'),
      field: { name: 'Potrero 9' },
    });

    expect(await zones.listAll()).toHaveLength(0);
    expect(await clients.listAll()).toHaveLength(0);
    const field = await fields.findById(result.fieldId);
    expect(field?.name).toBe('Potrero 9');
    expect(field?.zoneId).toBeUndefined();
    expect(field?.clientId).toBeUndefined();
  });

  it('uses an existing field by id without creating anything', async () => {
    const { uc, zones, clients, fields, visits } = build();
    await fields.save(new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }));

    const result = await uc.execute({
      visitedAt: at('2026-07-30'),
      field: { id: 'f1' },
    });

    expect(result.fieldId).toBe('f1');
    expect((await zones.listAll()).length).toBe(0);
    expect((await clients.listAll()).length).toBe(0);
    const done = await visits.findDoneByFieldOnDay('f1', at('2026-07-30'));
    expect(done).not.toBeNull();
  });

  it('propagates FieldNotFound for an unknown field id', async () => {
    const { uc } = build();
    await expect(
      uc.execute({ visitedAt: at('2026-07-30'), field: { id: 'nope' } }),
    ).rejects.toThrow(FieldNotFound);
  });

  it('propagates FutureVisitDate when the visit is in the future', async () => {
    const { uc } = build();
    await expect(
      uc.execute({ visitedAt: at('2026-08-02'), field: { name: 'X' } }),
    ).rejects.toThrow(FutureVisitDate);
  });
});
