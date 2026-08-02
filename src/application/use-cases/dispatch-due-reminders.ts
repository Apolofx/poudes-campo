import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { VisitRepository } from '@/domain/ports/outbound/visit-repository';
import type { FieldRepository } from '@/domain/ports/outbound/field-repository';
import type { Clock } from '@/domain/ports/outbound/clock';
import type { ReminderNotifier, DueReminder } from '@/domain/ports/outbound/reminder-notifier';

export class DispatchDueReminders {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly visits: VisitRepository,
    private readonly fields: FieldRepository,
    private readonly clock: Clock,
    private readonly notifier: ReminderNotifier,
  ) {}

  async execute(): Promise<DueReminder[]> {
    const now = this.clock.now();
    const [due, pendings, hierarchy] = await Promise.all([
      this.reminders.findDue(now),
      this.visits.findPendings(),
      this.fields.listAllWithHierarchy(),
    ]);

    const nextByField = new Map(pendings.map((p) => [p.fieldId, p.plannedFor as Date]));
    const hierByField = new Map(hierarchy.map((h) => [h.field.id, h]));

    const batch: DueReminder[] = [];
    for (const reminder of due) {
      reminder.markSent();
      await this.reminders.save(reminder);

      const h = hierByField.get(reminder.fieldId);
      if (!h) continue;
      batch.push({
        reminderId: reminder.id,
        fieldId: reminder.fieldId,
        fieldName: h.field.name,
        clientName: h.clientName,
        zoneName: h.zoneName,
        nextVisitDate: nextByField.get(reminder.fieldId) ?? reminder.remindAt,
        remindAt: reminder.remindAt,
      });
    }

    await this.notifier.notify(batch);
    return batch;
  }
}
