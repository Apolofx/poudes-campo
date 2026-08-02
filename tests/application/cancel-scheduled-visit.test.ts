import { describe, it, expect } from 'vitest';
import { CancelScheduledVisit } from '@/application/use-cases/cancel-scheduled-visit';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { ScheduledVisitNotFound } from '@/domain/shared/errors';
import { FixedClock } from '../support/fixed-clock';

const now = new Date('2026-07-31T12:00:00Z');

describe('CancelScheduledVisit', () => {
  it('cancels the scheduled visit and its own PENDING reminder', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: now }));
    await reminders.save(new Reminder({ id: 'r1', visitId: 's1', scheduledVisitId: 's1', fieldId: 'f1', remindAt: new Date('2026-08-07T00:00:00Z') }));

    const uc = new CancelScheduledVisit(scheduled, reminders, new FixedClock(now));
    await uc.execute({ scheduledVisitId: 's1' });

    const item = await scheduled.findById('s1');
    expect(item?.status).toBe('CANCELLED');
    expect(item?.cancelledAt?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
    expect(await reminders.findPendingByField('f1')).toHaveLength(0);
  });

  it('is idempotent on an already cancelled visit', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    await scheduled.save(new ScheduledVisit({ id: 's1', fieldId: 'f1', scheduledDate: new Date('2026-08-10T00:00:00Z'), reminderLeadDays: 3, createdAt: now, status: 'CANCELLED', cancelledAt: now }));

    const uc = new CancelScheduledVisit(scheduled, reminders, new FixedClock(now));
    await expect(uc.execute({ scheduledVisitId: 's1' })).resolves.toBeUndefined();
  });

  it('throws ScheduledVisitNotFound for an unknown id', async () => {
    const scheduled = new InMemoryScheduledVisitRepository();
    const reminders = new InMemoryReminderRepository();
    const uc = new CancelScheduledVisit(scheduled, reminders, new FixedClock(now));
    await expect(uc.execute({ scheduledVisitId: 'nope' })).rejects.toThrow(ScheduledVisitNotFound);
  });
});
