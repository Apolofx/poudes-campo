import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { VisitId } from '@/domain/shared/ids';
import { Visit } from '@/domain/entities/visit';
import { Reminder } from '@/domain/entities/reminder';
import { resolveFollowUp, remindAtFor, type FollowUpInput } from '@/application/use-cases/follow-up';
import { VisitNotFound, VisitAlreadyCancelled, FutureVisitDate, DuplicateVisitForDay } from '@/domain/shared/errors';

export interface EditVisitInput {
  visitId: VisitId;
  visitDate: Date;
  notes?: string;
  followUp: FollowUpInput;
}

export class EditVisit {
  constructor(
    private readonly visits: VisitRepository,
    private readonly reminders: ReminderRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: EditVisitInput): Promise<void> {
    const now = this.clock.now();

    const existing = await this.visits.findById(input.visitId);
    if (!existing) throw new VisitNotFound(`unknown visit ${input.visitId}`);
    if (existing.status === 'CANCELLED') throw new VisitAlreadyCancelled(`visit ${input.visitId} is cancelled`);

    if (input.visitDate.getTime() > now.getTime()) {
      throw new FutureVisitDate('visit date cannot be in the future');
    }

    const clash = await this.visits.findActiveByFieldOnDay(existing.fieldId, input.visitDate);
    if (clash && clash.id !== existing.id) {
      throw new DuplicateVisitForDay(`field ${existing.fieldId} already has a visit that day`);
    }

    const followUp = resolveFollowUp(input.followUp, now);

    await this.visits.save(
      new Visit({
        id: existing.id,
        fieldId: existing.fieldId,
        visitDate: input.visitDate,
        createdAt: existing.createdAt,
        notes: input.notes,
        followUp,
        status: 'ACTIVE',
      }),
    );

    // Cancel this visit's own PENDING reminder, if any.
    const pending = await this.reminders.findPendingByField(existing.fieldId);
    for (const reminder of pending) {
      if (reminder.visitId !== existing.id) continue;
      reminder.cancel();
      await this.reminders.save(reminder);
    }

    if (!followUp) return;
    if (!(await this.isLatestActive(existing.fieldId, existing.id))) return;

    const requestedLead = input.followUp.kind === 'none' ? 0 : input.followUp.reminderLeadDays ?? 0;
    await this.reminders.save(
      new Reminder({
        id: this.ids.next(),
        visitId: existing.id,
        fieldId: existing.fieldId,
        remindAt: remindAtFor(followUp, requestedLead),
      }),
    );
  }

  private async isLatestActive(fieldId: string, visitId: VisitId): Promise<boolean> {
    const all = await this.visits.listByField(fieldId);
    let latest: { id: VisitId; createdAt: Date } | undefined;
    for (const v of all) {
      if (v.status !== 'ACTIVE') continue;
      if (!latest || v.createdAt.getTime() > latest.createdAt.getTime()) {
        latest = { id: v.id, createdAt: v.createdAt };
      }
    }
    return latest?.id === visitId;
  }
}
