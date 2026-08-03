import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { FieldId, VisitId, ReminderId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { FieldNotFound, FutureVisitDate, DuplicateVisitForDay } from '@/domain/shared/errors';
import { addDays, isoDay } from '@/domain/shared/date-utils';
import { resolveNextPending, type NextVisitInput } from '@/application/use-cases/next-visit';

export type { NextVisitInput };

export interface RecordVisitInput {
  fieldId: FieldId;
  visitedAt: Date;
  notes?: string;
  next?: NextVisitInput;
}

export interface RecordVisitResult {
  visitId: VisitId;
  pendingId?: VisitId;
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
    const today = this.clock.today();

    const field = await this.fields.findById(input.fieldId);
    if (!field) throw new FieldNotFound(`unknown field ${input.fieldId}`);

    if (isoDay(input.visitedAt) > today) {
      throw new FutureVisitDate('visit date cannot be in the future');
    }

    const clash = await this.visits.findDoneByFieldOnDay(input.fieldId, input.visitedAt);
    if (clash) throw new DuplicateVisitForDay(`field ${input.fieldId} already has a done visit that day`);

    // Cumplir la PENDIENTE activa del lote si existe; si no, crear una DONE nueva.
    const pending = await this.visits.findPendingByField(input.fieldId);
    let visitId: VisitId;
    if (pending) {
      await this.visits.save(
        new Visit({
          id: pending.id,
          fieldId: pending.fieldId,
          status: 'DONE',
          plannedFor: pending.plannedFor,
          visitedAt: input.visitedAt,
          notes: input.notes,
          createdAt: pending.createdAt,
        }),
      );
      visitId = pending.id;
    } else {
      const visit = new Visit({
        id: this.ids.next(),
        fieldId: input.fieldId,
        status: 'DONE',
        visitedAt: input.visitedAt,
        notes: input.notes,
        createdAt: now,
      });
      await this.visits.save(visit);
      visitId = visit.id;
    }

    // Una sola voz: registrar deja de lado cualquier aviso previo del lote.
    const previous = await this.reminders.findPendingByField(input.fieldId);
    for (const reminder of previous) {
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    const next = resolveNextPending(input.next ?? { kind: 'none' }, now, today);
    if (!next) return { visitId };

    const pendingRecord = new Visit({
      id: this.ids.next(),
      fieldId: input.fieldId,
      status: 'PENDING',
      plannedFor: next.plannedFor,
      reminderLeadDays: next.reminderLeadDays,
      createdAt: now,
    });
    await this.visits.save(pendingRecord);

    const reminder = new Reminder({
      id: this.ids.next(),
      visitId: pendingRecord.id,
      fieldId: input.fieldId,
      remindAt: addDays(next.plannedFor, -next.reminderLeadDays),
    });
    await this.reminders.save(reminder);

    return { visitId, pendingId: pendingRecord.id, reminderId: reminder.id };
  }
}
