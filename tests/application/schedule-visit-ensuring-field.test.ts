import { describe, it, expect } from 'vitest';
import { ScheduleVisitEnsuringField } from '@/application/use-cases/schedule-visit-ensuring-field';
import { ScheduleVisit } from '@/application/use-cases/schedule-visit';
import { CreateZone, ListZones } from '@/application/use-cases/zone-catalog';
import { CreateClient, ListClients } from '@/application/use-cases/client-catalog';
import { CreateField, ListCatalogFields } from '@/application/use-cases/field-catalog';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { FieldNotFound, ScheduledDateNotFuture } from '@/domain/shared/errors';
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
  const scheduled = new InMemoryScheduledVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const ids = new IncrementingIdGenerator();
  const createZone = new CreateZone(zones, ids);
  const createClient = new CreateClient(clients, ids);
  const createField = new CreateField(fields, ids);
  const scheduleVisit = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), ids);
  const uc = new ScheduleVisitEnsuringField(createZone, createClient, createField, scheduleVisit);
  return {
    uc,
    zones,
    clients,
    fields,
    scheduled,
    reminders,
    createZone,
    createClient,
    createField,
  };
}

describe('ScheduleVisitEnsuringField', () => {
  it('creates zone, client and field from names and schedules the visit', async () => {
    const { uc, zones, clients, fields, scheduled, reminders } = build();

    const result = await uc.execute({
      scheduledDate: at('2026-08-10'),
      reminderLeadDays: 3,
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

    const active = await scheduled.findActiveByField(result.fieldId);
    expect(active?.scheduledDate.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    const [reminder] = await reminders.findPendingByField(result.fieldId);
    expect(reminder.scheduledVisitId).toBe(result.scheduledVisitId);
  });

  it('creates a field without zone or client when refs are omitted', async () => {
    const { uc, zones, clients, fields } = build();

    const result = await uc.execute({
      scheduledDate: at('2026-08-10'),
      reminderLeadDays: 3,
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
    const { uc, zones, clients, fields, scheduled } = build();
    const zoneMap = new Map([['z1', new Zone('z1', 'Norte')]]);
    const clientMap = new Map([['c1', new Client('c1', 'Pérez')]]);
    await fields.save(new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }));

    const result = await uc.execute({
      scheduledDate: at('2026-08-10'),
      reminderLeadDays: 3,
      field: { id: 'f1' },
    });

    expect(result.fieldId).toBe('f1');
    expect((await zones.listAll()).length).toBe(0);
    expect((await clients.listAll()).length).toBe(0);
    const active = await scheduled.findActiveByField('f1');
    expect(active).not.toBeNull();
  });

  it('propagates FieldNotFound for an unknown field id', async () => {
    const { uc } = build();
    await expect(
      uc.execute({ scheduledDate: at('2026-08-10'), reminderLeadDays: 3, field: { id: 'nope' } }),
    ).rejects.toThrow(FieldNotFound);
  });

  it('propagates ScheduledDateNotFuture', async () => {
    const { uc } = build();
    await expect(
      uc.execute({ scheduledDate: now, reminderLeadDays: 3, field: { name: 'X' } }),
    ).rejects.toThrow(ScheduledDateNotFuture);
  });
});
