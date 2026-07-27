import { describe, it, expect } from 'vitest';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { Coordinates } from '@/domain/value-objects/coordinates';
import { Hectares } from '@/domain/value-objects/hectares';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import {
  toFieldRecord, fromFieldRecord,
  toVisitRecord, fromVisitRecord,
  toReminderRecord, fromReminderRecord,
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
  it('round-trips a visit with follow-up', () => {
    const visit = new Visit({
      id: 'v1', fieldId: 'f1',
      visitDate: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-20T10:05:00Z'),
      notes: 'todo bien',
      followUp: { nextVisitDate: new Date('2026-08-03T10:05:00Z'), interval: VisitInterval.ofDays(14) },
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.id).toBe('v1');
    expect(back.notes).toBe('todo bien');
    expect(back.status).toBe('ACTIVE');
    expect(back.followUp?.interval.days).toBe(14);
    expect(back.followUp?.nextVisitDate.getTime()).toBe(new Date('2026-08-03T10:05:00Z').getTime());
  });

  it('round-trips a visit without follow-up', () => {
    const visit = new Visit({
      id: 'v2', fieldId: 'f1',
      visitDate: new Date('2026-07-20T10:00:00Z'),
      createdAt: new Date('2026-07-20T10:05:00Z'),
    });
    const back = fromVisitRecord(toVisitRecord(visit));
    expect(back.followUp).toBeUndefined();
  });
});

describe('reminder record mapping', () => {
  it('round-trips a reminder preserving status', () => {
    const reminder = new Reminder({
      id: 'r1', visitId: 'v1', fieldId: 'f1',
      remindAt: new Date('2026-07-31T10:05:00Z'), status: 'PENDING',
    });
    const back = fromReminderRecord(toReminderRecord(reminder));
    expect(back.id).toBe('r1');
    expect(back.visitId).toBe('v1');
    expect(back.status).toBe('PENDING');
    expect(back.remindAt.getTime()).toBe(new Date('2026-07-31T10:05:00Z').getTime());
  });
});
