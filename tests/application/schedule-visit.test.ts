import { describe, it, expect } from 'vitest';
import { ScheduleVisit } from '@/application/use-cases/schedule-visit';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { FieldNotFound, PlannedDateNotFuture } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

const now = new Date('2026-07-31T12:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function build() {
  const zones = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  return { fields, visits, reminders };
}

function pending(id: string, plannedFor: Date): Visit {
  return new Visit({
    id, fieldId: 'f1', status: 'PENDING',
    plannedFor, reminderLeadDays: 3, createdAt: now,
  });
}

describe('ScheduleVisit', () => {
  it('schedules a pending visit with a clamped reminder lead', async () => {
    const { fields, visits, reminders } = build();
    const uc = new ScheduleVisit(fields, visits, reminders, new FixedClock(now), new IncrementingIdGenerator());

    const result = await uc.execute({ fieldId: 'f1', plannedFor: at('2026-08-10'), reminderLeadDays: 3 });

    const item = await visits.findById(result.visitId);
    expect(item?.status).toBe('PENDING');
    expect(item?.plannedFor?.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(item?.reminderLeadDays).toBe(3);
    const [reminder] = await reminders.findPendingByField('f1');
    expect(reminder.visitId).toBe(result.visitId);
    expect(reminder.remindAt.toISOString()).toBe('2026-08-07T00:00:00.000Z');
  });

  it('clamps a lead longer than the gap to the gap itself', async () => {
    const { fields, visits, reminders } = build();
    const uc = new ScheduleVisit(fields, visits, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await uc.execute({ fieldId: 'f1', plannedFor: at('2026-08-02'), reminderLeadDays: 5 });

    const item = await visits.findPendingByField('f1');
    expect(item?.reminderLeadDays).toBe(2);
    const [reminder] = await reminders.findPendingByField('f1');
    expect(reminder.remindAt.toISOString()).toBe('2026-07-31T00:00:00.000Z');
  });

  it('rejects a planned date that is not in the future', async () => {
    const { fields, visits, reminders } = build();
    const uc = new ScheduleVisit(fields, visits, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await expect(uc.execute({ fieldId: 'f1', plannedFor: now, reminderLeadDays: 3 })).rejects.toThrow(PlannedDateNotFuture);
  });

  it('rejects an unknown field', async () => {
    const { fields, visits, reminders } = build();
    const uc = new ScheduleVisit(fields, visits, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await expect(uc.execute({ fieldId: 'nope', plannedFor: at('2026-08-10'), reminderLeadDays: 3 })).rejects.toThrow(FieldNotFound);
  });

  it('replaces an existing pending visit for the field', async () => {
    const { fields, visits, reminders } = build();
    const uc = new ScheduleVisit(fields, visits, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await visits.save(pending('p1', at('2026-08-10')));

    await uc.execute({ fieldId: 'f1', plannedFor: at('2026-08-20'), reminderLeadDays: 0 });

    const active = await visits.findPendingByField('f1');
    expect(active?.plannedFor?.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    const old = await visits.findById('p1');
    expect(old?.status).toBe('CANCELLED');
    expect(old?.cancelledAt?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
    expect(await reminders.findPendingByField('f1')).toHaveLength(1);
  });

  it('cancels prior pending reminders for the field', async () => {
    const { fields, visits, reminders } = build();
    const uc = new ScheduleVisit(fields, visits, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await visits.save(pending('p0', at('2026-08-05')));
    await reminders.save(new Reminder({ id: 'r0', visitId: 'p0', fieldId: 'f1', remindAt: at('2026-08-04') }));

    await uc.execute({ fieldId: 'f1', plannedFor: at('2026-08-10'), reminderLeadDays: 3 });

    const pendingReminders = await reminders.findPendingByField('f1');
    expect(pendingReminders).toHaveLength(1);
    expect(pendingReminders[0].visitId).not.toBe('p0');
  });
});
