import type { ScheduledVisitRepository } from '@/domain/ports/outbound/scheduled-visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { ScheduledVisitId } from '@/domain/shared/ids';
import { ScheduledVisit } from '@/domain/entities/scheduled-visit';
import { ScheduledVisitNotFound } from '@/domain/shared/errors';

export interface CancelScheduledVisitInput {
  scheduledVisitId: ScheduledVisitId;
}

export class CancelScheduledVisit {
  constructor(
    private readonly scheduled: ScheduledVisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CancelScheduledVisitInput): Promise<void> {
    const item = await this.scheduled.findById(input.scheduledVisitId);
    if (!item) throw new ScheduledVisitNotFound(`unknown scheduled visit ${input.scheduledVisitId}`);
    if (item.status === 'CANCELLED') return;

    await this.scheduled.save(
      new ScheduledVisit({
        id: item.id,
        fieldId: item.fieldId,
        scheduledDate: item.scheduledDate,
        reminderLeadDays: item.reminderLeadDays,
        createdAt: item.createdAt,
        notes: item.notes,
        status: 'CANCELLED',
        cancelledAt: this.clock.now(),
      }),
    );

    const pending = await this.reminders.findPendingByField(item.fieldId);
    for (const reminder of pending) {
      if (reminder.scheduledVisitId !== item.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }
  }
}
