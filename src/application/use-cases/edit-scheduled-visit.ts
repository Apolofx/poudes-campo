import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { ScheduledVisitId } from '@/domain/shared/ids';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { ScheduledVisitNotFound, ScheduledVisitAlreadyCancelled, ScheduledDateNotFuture } from '@/domain/shared/errors';
import { addDays, daysBetween } from '@/domain/shared/date-utils';

export interface EditScheduledVisitInput {
  scheduledVisitId: ScheduledVisitId;
  scheduledDate: Date;
  reminderLeadDays: number;
  notes?: string;
}

export class EditScheduledVisit {
  constructor(
    private readonly scheduled: ScheduledVisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: EditScheduledVisitInput): Promise<void> {
    const now = this.clock.now();

    const existing = await this.scheduled.findById(input.scheduledVisitId);
    if (!existing) throw new ScheduledVisitNotFound(`unknown scheduled visit ${input.scheduledVisitId}`);
    if (existing.status === 'CANCELLED') {
      throw new ScheduledVisitAlreadyCancelled(`scheduled visit ${input.scheduledVisitId} is cancelled`);
    }
    if (input.scheduledDate.getTime() <= now.getTime()) {
      throw new ScheduledDateNotFuture('scheduled date must be in the future');
    }

    const lead = Math.min(
      Math.max(input.reminderLeadDays, 0),
      daysBetween(now, input.scheduledDate),
    );

    await this.scheduled.save(
      new ScheduledVisit({
        id: existing.id,
        fieldId: existing.fieldId,
        scheduledDate: input.scheduledDate,
        reminderLeadDays: lead,
        createdAt: existing.createdAt,
        notes: input.notes,
        status: 'ACTIVE',
      }),
    );

    const pending = await this.reminders.findPendingByField(existing.fieldId);
    for (const reminder of pending) {
      if (reminder.scheduledVisitId !== existing.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    await this.reminders.save(
      new Reminder({
        id: this.ids.next(),
        visitId: existing.id,
        scheduledVisitId: existing.id,
        fieldId: existing.fieldId,
        remindAt: addDays(input.scheduledDate, -lead),
      }),
    );
  }
}
