import { describe, it, expect } from 'vitest';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { VisitInterval } from '@/domain/value-objects/visit-interval';
import { FixedClock } from '../support/fixed-clock';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function makeDispatch(now: Date) {
  const zones = new Map([['z1', new Zone('z1', 'Norte')], ['z2', new Zone('z2', 'Sur')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Loma', clientId: 'c1', zoneId: 'z2' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const notifier = new InAppReminderNotifier();
  const dispatch = new DispatchDueReminders(reminders, visits, fields, new FixedClock(now), notifier);
  return { visits, reminders, notifier, dispatch };
}

const withFollowUp = (id: string, fieldId: string, next: string) =>
  new Visit({
    id, fieldId, visitDate: at('2026-07-01'), createdAt: at('2026-07-01'),
    followUp: { nextVisitDate: at(next), interval: VisitInterval.ofDays(14) },
  });

const rem = (id: string, fieldId: string, remindAt: string) =>
  new Reminder({ id, visitId: `v-${id}`, fieldId, remindAt: at(remindAt) });

describe('DispatchDueReminders', () => {
  it('marks due reminders SENT, enriches them, and notifies', async () => {
    const now = at('2026-07-29');
    const { visits, reminders, notifier, dispatch } = makeDispatch(now);
    await visits.save(withFollowUp('v1', 'f1', '2026-08-01'));
    await reminders.save(rem('r1', 'f1', '2026-07-28')); // due
    await reminders.save(rem('r2', 'f2', '2026-08-15')); // future

    const batch = await dispatch.execute();

    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({
      reminderId: 'r1', fieldId: 'f1', fieldName: 'El Alto',
      clientName: 'Pérez', zoneName: 'Norte', nextVisitDate: at('2026-08-01'),
    });
    expect(notifier.snapshot()).toEqual(batch);
    expect(await reminders.findDue(now)).toEqual([]); // r1 ya no está PENDING
  });

  it('is idempotent: a second run finds nothing and notifies an empty batch', async () => {
    const now = at('2026-07-29');
    const { visits, reminders, notifier, dispatch } = makeDispatch(now);
    await visits.save(withFollowUp('v1', 'f1', '2026-08-01'));
    await reminders.save(rem('r1', 'f1', '2026-07-28'));

    await dispatch.execute();
    const second = await dispatch.execute();

    expect(second).toEqual([]);
    expect(notifier.snapshot()).toEqual([]);
  });

  it('marks a reminder SENT even when its field is missing from the hierarchy, but excludes it from the batch', async () => {
    const now = at('2026-07-29');
    const { reminders, dispatch } = makeDispatch(now);
    await reminders.save(rem('orphan', 'ghost', '2026-07-28'));

    const batch = await dispatch.execute();

    expect(batch).toEqual([]);
    expect(await reminders.findDue(now)).toEqual([]); // igual pasó a SENT
  });
});
