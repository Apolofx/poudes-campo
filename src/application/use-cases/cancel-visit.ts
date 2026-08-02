import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { VisitId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { VisitNotFound } from '@/domain/shared/errors';

export interface CancelVisitInput {
  visitId: VisitId;
}

export class CancelVisit {
  constructor(
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CancelVisitInput): Promise<void> {
    const visit = await this.visits.findById(input.visitId);
    if (!visit) throw new VisitNotFound(`unknown visit ${input.visitId}`);
    if (visit.status === 'CANCELLED') return;

    await this.visits.save(
      new Visit({
        id: visit.id,
        fieldId: visit.fieldId,
        status: 'CANCELLED',
        plannedFor: visit.plannedFor,
        visitedAt: visit.visitedAt,
        reminderLeadDays: visit.reminderLeadDays,
        notes: visit.notes,
        createdAt: visit.createdAt,
        cancelledAt: this.clock.now(),
      }),
    );

    const pending = await this.reminders.findPendingByField(visit.fieldId);
    for (const reminder of pending) {
      if (reminder.visitId !== visit.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }
  }
}
