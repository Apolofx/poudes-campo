import { describe, it, expect } from 'vitest';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import {
  toFieldRecord, fromFieldRecord,
  toVisitRecord, fromVisitRecord,
  toReminderRecord, fromReminderRecord,
  toZoneRecord, fromZoneRecord,
  toClientRecord, fromClientRecord,
} from '@/infrastructure/persistence/idb/records';

describe('field record mapping', () => {
  it('round-trips a full field', () => {
    const field = new Field({
      id: 'f1', name: 'Lote 1', clientId: 'c1', zoneId: 'z1',
      coordinates: Coordinates.of(-34.6, -58.4), hectares: Hectares.of(12.5), crop: 'soja',
    });
    const back = fromFieldRecord(toFieldRecord(field));
    expect(back.name).toBe('Lote 1');
    expect(back.coordinates?.latitude).toBe(-34.6);
    expect(back.coordinates?.longitude).toBe(-58.4);
    expect(back.hectares?.value).toBe(12.5);
    expect(back.crop).toBe('soja');
  });

  it('round-trips a minimal field with no optionals', () => {
    const field = new Field({ id: 'f2', name: 'Lote 2', clientId: 'c1', zoneId: 'z1' });
    const back = fromFieldRecord(toFieldRecord(field));
    expect(back.coordinates).toBeUndefined();
    expect(back.hectares).toBeUndefined();
    expect(back.crop).toBeUndefined();
  });
});

describe('visit record mapping', () => {
  it('round-trips a pending visit with plannedFor and reminderLeadDays', () => {
    const visit = new Visit({
      id: 'v1', fieldId: 'f1',
      status: 'PENDING',
      plannedFor: new Date('2026-08-10T00:00:00Z'),
      reminderLeadDays: 3,
      createdAt: new Date('2026-07-31T12:00:00Z'),
      notes: 'todo bien',
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.id).toBe('v1');
    expect(back.status).toBe('PENDING');
    expect(back.plannedFor?.getTime()).toBe(new Date('2026-08-10T00:00:00Z').getTime());
    expect(back.reminderLeadDays).toBe(3);
    expect(back.notes).toBe('todo bien');
    expect(back.visitedAt).toBeUndefined();
  });

  it('round-trips a done visit with visitedAt', () => {
    const visit = new Visit({
      id: 'v2', fieldId: 'f1',
      status: 'DONE',
      visitedAt: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-20T10:05:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('DONE');
    expect(back.visitedAt?.getTime()).toBe(new Date('2026-07-20T10:00:00Z').getTime());
    expect(back.plannedFor).toBeUndefined();
  });

  it('round-trips a cancelled visit with cancelledAt', () => {
    const visit = new Visit({
      id: 'v3', fieldId: 'f1',
      status: 'CANCELLED',
      cancelledAt: new Date('2026-08-01T00:00:00Z'),
      createdAt: new Date('2026-07-31T12:00:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.status).toBe('CANCELLED');
    expect(back.cancelledAt?.getTime()).toBe(new Date('2026-08-01T00:00:00Z').getTime());
  });
});

describe('reminder record mapping', () => {
  it('round-trips a reminder preserving status', () => {
    const reminder = new Reminder({
      id: 'r1', visitId: 'v1', fieldId: 'f1',
      remindAt: new Date('2026-08-07T10:05:00Z'), status: 'PENDING',
    });
    const back = fromReminderRecord(toReminderRecord(reminder));
    expect(back.id).toBe('r1');
    expect(back.visitId).toBe('v1');
    expect(back.status).toBe('PENDING');
    expect(back.remindAt.getTime()).toBe(new Date('2026-08-07T10:05:00Z').getTime());
  });
});

describe('zone/client record mappers', () => {
  it('round-trips a zone with archived', () => {
    const z = fromZoneRecord(toZoneRecord(new Zone('z1', 'Norte', true)));
    expect(z.name).toBe('Norte');
    expect(z.archived).toBe(true);
  });
  it('defaults archived to false for legacy records without the flag', () => {
    expect(fromZoneRecord({ id: 'z1', name: 'Norte' }).archived).toBe(false);
    expect(fromClientRecord({ id: 'c1', name: 'Pérez' }).archived).toBe(false);
  });
});

describe('field record mappers with optional refs + archived', () => {
  it('round-trips an orphan archived field', () => {
    const f = fromFieldRecord(toFieldRecord(new Field({ id: 'f1', name: 'X', archived: true })));
    expect(f.clientId).toBeUndefined();
    expect(f.zoneId).toBeUndefined();
    expect(f.archived).toBe(true);
  });
  it('defaults archived to false for legacy field records', () => {
    expect(fromFieldRecord({ id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' }).archived).toBe(false);
  });
});
