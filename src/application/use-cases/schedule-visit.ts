import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, VisitId, ReminderId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { FieldNotFound, PlannedDateNotFuture } from '@/domain/shared/errors';
import { addDays, daysBetween } from '@/domain/shared/date-utils';
import { clampLeadDays } from '@/application/use-cases/next-visit';

export interface ScheduleVisitInput {
  fieldId: FieldId;
  plannedFor: Date;
  reminderLeadDays: number;
  notes?: string;
}

export interface ScheduleVisitResult {
  visitId: VisitId;
  reminderId: ReminderId;
}

export class ScheduleVisit {
  constructor(
    private readonly fields: FieldRepository,
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ScheduleVisitInput): Promise<ScheduleVisitResult> {
    const now = this.clock.now();

    const field = await this.fields.findById(input.fieldId);
    if (!field) throw new FieldNotFound(`unknown field ${input.fieldId}`);

    if (input.plannedFor.getTime() <= now.getTime()) {
      throw new PlannedDateNotFuture('planned date must be in the future');
    }

    // Decisión 3: programar reemplaza la PENDIENTE activa del lote.
    const existing = await this.visits.findPendingByField(input.fieldId);
    if (existing) {
      await this.visits.save(
        new Visit({
          id: existing.id,
          fieldId: existing.fieldId,
          status: 'CANCELLED',
          plannedFor: existing.plannedFor,
          reminderLeadDays: existing.reminderLeadDays,
          notes: existing.notes,
          createdAt: existing.createdAt,
          cancelledAt: now,
        }),
      );
    }

    const previous = await this.reminders.findPendingByField(input.fieldId);
    for (const reminder of previous) {
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    const lead = clampLeadDays(input.reminderLeadDays, daysBetween(now, input.plannedFor));

    const visit = new Visit({
      id: this.ids.next(),
      fieldId: input.fieldId,
      status: 'PENDING',
      plannedFor: input.plannedFor,
      reminderLeadDays: lead,
      notes: input.notes,
      createdAt: now,
    });
    await this.visits.save(visit);

    const reminder = new Reminder({
      id: this.ids.next(),
      visitId: visit.id,
      fieldId: input.fieldId,
      remindAt: addDays(input.plannedFor, -lead),
    });
    await this.reminders.save(reminder);

    return { visitId: visit.id, reminderId: reminder.id };
  }
}
