import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, VisitId, ReminderId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { FieldNotFound, FutureVisitDate, DuplicateVisitForDay } from '@/domain/shared/errors';
import { resolveFollowUp, remindAtFor, type FollowUpInput } from '@/application/use-cases/follow-up';

export type { FollowUpInput };

export interface RecordVisitInput {
  fieldId: FieldId;
  visitDate: Date;
  notes?: string;
  followUp: FollowUpInput;
}

export interface RecordVisitResult {
  visitId: VisitId;
  reminderId?: ReminderId;
}

export class RecordVisit {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RecordVisitInput): Promise<RecordVisitResult> {
    const now = this.clock.now();

    const field = await this.fields.findById(input.fieldId);
    if (!field) throw new FieldNotFound(`unknown field ${input.fieldId}`);

    if (input.visitDate.getTime() > now.getTime()) {
      throw new FutureVisitDate('visit date cannot be in the future');
    }

    const clash = await this.visits.findActiveByFieldOnDay(input.fieldId, input.visitDate);
    if (clash) throw new DuplicateVisitForDay(`field ${input.fieldId} already has a visit that day`);

    const followUp = resolveFollowUp(input.followUp, now);

    const visit = new Visit({
      id: this.ids.next(),
      fieldId: input.fieldId,
      visitDate: input.visitDate,
      createdAt: now,
      notes: input.notes,
      followUp,
    });
    await this.visits.save(visit);

    // Recording any visit supersedes prior pending reminders for the field.
    const pending = await this.reminders.findPendingByField(input.fieldId);
    for (const reminder of pending) {
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    if (!followUp) return { visitId: visit.id };

    const requestedLead = input.followUp.kind === 'none' ? 0 : input.followUp.reminderLeadDays ?? 0;
    const reminder = new Reminder({
      id: this.ids.next(),
      visitId: visit.id,
      fieldId: input.fieldId,
      remindAt: remindAtFor(followUp, requestedLead),
    });
    await this.reminders.save(reminder);

    return { visitId: visit.id, reminderId: reminder.id };
  }
}
