import { describe, it, expect } from 'vitest';
import { EditScheduledVisit } from '@/application/use-cases/edit-scheduled-visit';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { ScheduledVisitNotFound, ScheduledVisitAlreadyCancelled, ScheduledDateNotFuture } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';
import { IncrementingIdGenerator } from '../support/incrementing-id-generator';

const now = new Date('2026-07-31T12:00:00Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('EditScheduledVisit', () => {
  it('updates date/lead/notes and recreates its own reminder', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now }));
    await reminders.save(new Reminder({ id: 'r1', visitId: 's1', scheduledVisitId: 's1', fieldId: 'f1', remindAt: at('2026-08-07') }));

    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await uc.execute({ scheduledVisitId: 's1', scheduledDate: at('2026-08-20'), reminderLeadDays: 1, notes: 'revisar' });

    const item = await scheduled.findById('s1');
    expect(item?.scheduledDate.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    expect(item?.reminderLeadDays).toBe(1);
    expect(item?.notes).toBe('revisar');
    const pending = await reminders.findPendingByField('f1');
    expect(pending).toHaveLength(1);
    expect(pending[0].remindAt.toISOString()).toBe('2026-08-19T00:00:00.000Z');
  });

  it('re-clamps the lead to the new gap', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now }));

    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await uc.execute({ scheduledVisitId: 's1', scheduledDate: at('2026-08-02'), reminderLeadDays: 9 });

    const item = await scheduled.findById('s1');
    expect(item?.reminderLeadDays).toBe(2);
  });

  it('rejects a non-future date', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now }));

    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await expect(uc.execute({ scheduledVisitId: 's1', scheduledDate: now, reminderLeadDays: 3 })).rejects.toThrow(ScheduledDateNotFuture);
  });

  it('throws for unknown or already cancelled visits', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    const uc = new EditScheduledVisit(scheduled, reminders, new FixedClock(now), new IncrementingIdGenerator());
    await expect(uc.execute({ scheduledVisitId: 'nope', scheduledDate: at('2026-08-20'), reminderLeadDays: 3 })).rejects.toThrow(ScheduledVisitNotFound);

    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: at('2026-08-10'), reminderLeadDays: 3, createdAt: now, status: 'CANCELLED', cancelledAt: now }));
    await expect(uc.execute({ scheduledVisitId: 's1', scheduledDate: at('2026-08-20'), reminderLeadDays: 3 })).rejects.toThrow(ScheduledVisitAlreadyCancelled);
  });
});
