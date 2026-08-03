import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { VisitId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { addDays, daysBetweenIso, isoDay } from '@/domain/shared/date-utils';
import { clampLeadDays } from '@/application/use-cases/next-visit';
import {
  VisitNotFound,
  VisitAlreadyCancelled,
  InvalidVisit,
  PlannedDateNotFuture,
  FutureVisitDate,
  DuplicateVisitForDay,
} from '@/domain/shared/errors';

export type EditVisitInput =
  | { kind: 'pending'; visitId: VisitId; plannedFor: Date; reminderLeadDays: number; notes?: string }
  | { kind: 'done'; visitId: VisitId; visitedAt: Date; notes?: string };

export class EditVisit {
  constructor(
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: EditVisitInput): Promise<void> {
    const today = this.clock.today();

    const existing = await this.visits.findById(input.visitId);
    if (!existing) throw new VisitNotFound(`unknown visit ${input.visitId}`);
    if (existing.status === 'CANCELLED') throw new VisitAlreadyCancelled(`visit ${input.visitId} is cancelled`);

    if (input.kind === 'pending') {
      await this.editPending(existing, input, today);
      return;
    }
    await this.editDone(existing, input, today);
  }

  private async editPending(
    existing: Visit,
    input: Extract<EditVisitInput, { kind: 'pending' }>,
    today: string,
  ): Promise<void> {
    if (existing.status !== 'PENDING') {
      throw new InvalidVisit(`visit ${existing.id} is not pending`);
    }
    if (isoDay(input.plannedFor) <= today) {
      throw new PlannedDateNotFuture('planned date must be in the future');
    }

    const lead = clampLeadDays(input.reminderLeadDays, daysBetweenIso(today, isoDay(input.plannedFor)));

    await this.visits.save(
      new Visit({
        id: existing.id,
        fieldId: existing.fieldId,
        status: 'PENDING',
        plannedFor: input.plannedFor,
        reminderLeadDays: lead,
        notes: input.notes,
        createdAt: existing.createdAt,
      }),
    );

    // Recrear el reminder propio con el nuevo lead.
    const pending = await this.reminders.findPendingByField(existing.fieldId);
    for (const reminder of pending) {
      if (reminder.visitId !== existing.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }
    await this.reminders.save(
      new Reminder({
        id: this.ids.next(),
        visitId: existing.id,
        fieldId: existing.fieldId,
        remindAt: addDays(input.plannedFor, -lead),
      }),
    );
  }

  private async editDone(
    existing: Visit,
    input: Extract<EditVisitInput, { kind: 'done' }>,
    today: string,
  ): Promise<void> {
    if (existing.status !== 'DONE') {
      throw new InvalidVisit(`visit ${existing.id} is not done`);
    }
    if (isoDay(input.visitedAt) > today) {
      throw new FutureVisitDate('visit date cannot be in the future');
    }

    const clash = await this.visits.findDoneByFieldOnDay(existing.fieldId, input.visitedAt);
    if (clash && clash.id !== existing.id) {
      throw new DuplicateVisitForDay(`field ${existing.fieldId} already has a done visit that day`);
    }

    await this.visits.save(
      new Visit({
        id: existing.id,
        fieldId: existing.fieldId,
        status: 'DONE',
        plannedFor: existing.plannedFor,
        visitedAt: input.visitedAt,
        notes: input.notes,
        createdAt: existing.createdAt,
      }),
    );
  }
}
