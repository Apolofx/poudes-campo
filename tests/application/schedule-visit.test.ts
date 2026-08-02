import { describe, it, expect } from 'vitest';
import { ScheduleVisit } from '@/application/use-cases/schedule-visit';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { FieldNotFound, ScheduledDateNotFuture } from '@/domain/shared/errors';
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
  const scheduled = new InMemoryScheduledVisitRepository();
  const reminders = new InMemoryReminderRepository();
  return { fields, scheduled, reminders };
}

describe('ScheduleVisit', () => {
  it('schedules a visit with a clamped reminder lead', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    const result = await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 });

    const item = await scheduled.findById(result.scheduledVisitId);
    expect(item?.scheduledDate.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(item?.reminderLeadDays).toBe(3);
    const [reminder] = await reminders.findPendingByField('f1');
    expect(reminder.scheduledVisitId).toBe(result.scheduledVisitId);
    expect(reminder.remindAt.toISOString()).toBe('2026-08-07T00:00:00.000Z');
  });

  it('clamps a lead longer than the gap to the gap itself', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-02'), reminderLeadDays: 5 });

    const item = await scheduled.findActiveByField('f1');
    expect(item?.reminderLeadDays).toBe(2);
    const [reminder] = await reminders.findPendingByField('f1');
    expect(reminder.remindAt.toISOString()).toBe('2026-07-31T00:00:00.000Z');
  });

  it('rejects a scheduled date that is not in the future', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await expect(uc.execute({ fieldId: 'f1', scheduledDate: now, reminderLeadDays: 3 })).rejects.toThrow(ScheduledDateNotFuture);
  });

  it('rejects an unknown field', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());

    await expect(uc.execute({ fieldId: 'nope', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 })).rejects.toThrow(FieldNotFound);
  });

  it('replaces an existing ACTIVE scheduled visit for the field', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 });

    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-20'), reminderLeadDays: 0 });

    const active = await scheduled.findActiveByField('f1');
    expect(active?.scheduledDate.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    const all = await scheduled.listByField('f1');
    expect(all.filter((s) => s.status === 'CANCELLED')).toHaveLength(1);
    expect(await reminders.findPendingByField('f1')).toHaveLength(1);
  });

  it('cancels prior PENDING reminders for the field', async () => {
    const { fields, scheduled, reminders } = build();
    const uc = new ScheduleVisit(fields, scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await scheduled.save(new ScheduledVisit({
      id: 's0', fieldId: 'f1', scheduledDate: at('2026-08-05'), reminderLeadDays: 1, createdAt: now,
    }));
    await reminders.save(new Reminder({ id: 'r0', visitId: 'v0', scheduledVisitId: 's0', fieldId: 'f1', remindAt: at('2026-08-04') }));

    await uc.execute({ fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3 });

    const pending = await reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].scheduledVisitId).not.toBe('s0');
  });
});
