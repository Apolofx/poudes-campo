import type { Reminder } from '@/domain/entities/reminder';
import type { ReminderId, FieldId } from '@/domain/shared/ids';
import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';

export class InMemoryReminderRepository implements ReminderRepository {
  private readonly reminders = new Map<ReminderId, Reminder>();

  async save(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }

  async findPendingByField(fieldId: FieldId): Promise<Reminder[]> {
    return [...this.reminders.values()].filter(
      (reminder) => reminder.fieldId === fieldId && reminder.status === 'PENDING',
    );
  }
}
