import type { ReminderRepository } from '@/domain/ports/outbound/reminder-repository';
import type { Reminder } from '@/domain/entities/reminder';
import type { FieldId } from '@/domain/shared/ids';
import type { CampoDb } from './open-campo-db';
import { toReminderRecord, fromReminderRecord } from './records';

export class IdbReminderRepository implements ReminderRepository {
  constructor(private readonly db: CampoDb) {}

  async save(reminder: Reminder): Promise<void> {
    await this.db.put('reminders', toReminderRecord(reminder));
  }

  async findPendingByField(fieldId: FieldId): Promise<Reminder[]> {
    const records = await this.db.getAllFromIndex('reminders', 'by-field', fieldId);
    return records.filter((r) => r.status === 'PENDING').map(fromReminderRecord);
  }

  async findDue(now: Date): Promise<Reminder[]> {
    const records = await this.db.getAll('reminders');
    return records
      .filter((r) => r.status === 'PENDING' && r.remindAt.getTime() <= now.getTime())
      .map(fromReminderRecord);
  }
}
