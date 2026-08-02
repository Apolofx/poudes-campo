import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, ScheduledVisitId, ReminderId } from '@/domain/shared/ids';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { Reminder } from '@/domain/entities/reminder';
import { FieldNotFound, ScheduledDateNotFuture } from '@/domain/shared/errors';
import { addDays, daysBetween } from '@/domain/shared/date-utils';

export interface ScheduleVisitInput {
  fieldId: FieldId;
  scheduledDate: Date;
  reminderLeadDays: number;
  notes?: string;
}

export interface ScheduleVisitResult {
  scheduledVisitId: ScheduledVisitId;
  reminderId: ReminderId;
}

export class ScheduleVisit {
  constructor(
    private readonly fields: FieldRepository,
    private readonly scheduled: ScheduledVisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ScheduleVisitInput): Promise<ScheduleVisitResult> {
    const now = this.clock.now();

    const field = await this.fields.findById(input.fieldId);
    if (!field) throw new FieldNotFound(`unknown field ${input.fieldId}`);

    if (input.scheduledDate.getTime() <= now.getTime()) {
      throw new ScheduledDateNotFuture('scheduled date must be in the future');
    }

    const active = await this.scheduled.findActiveByField(input.fieldId);
    if (active) {
      await this.scheduled.save(
        new ScheduledVisit({
          id: active.id,
          fieldId: active.fieldId,
          scheduledDate: active.scheduledDate,
          reminderLeadDays: active.reminderLeadDays,
          createdAt: active.createdAt,
          notes: active.notes,
          status: 'CANCELLED',
          cancelledAt: now,
        }),
      );
    }

    const pending = await this.reminders.findPendingByField(input.fieldId);
    for (const reminder of pending) {
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    const lead = Math.min(
      Math.max(input.reminderLeadDays, 0),
      daysBetween(now, input.scheduledDate),
    );

    const scheduledVisit = new ScheduledVisit({
      id: this.ids.next(),
      fieldId: input.fieldId,
      scheduledDate: input.scheduledDate,
      reminderLeadDays: lead,
      createdAt: now,
      notes: input.notes,
    });
    await this.scheduled.save(scheduledVisit);

    const reminder = new Reminder({
      id: this.ids.next(),
      visitId: scheduledVisit.id,
      scheduledVisitId: scheduledVisit.id,
      fieldId: input.fieldId,
      remindAt: addDays(input.scheduledDate, -lead),
    });
    await this.reminders.save(reminder);

    return { scheduledVisitId: scheduledVisit.id, reminderId: reminder.id };
  }
}
