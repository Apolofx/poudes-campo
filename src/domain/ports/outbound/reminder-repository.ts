import type { Reminder } from '@/domain/entities/reminder';
import type { FieldId } from '@/domain/shared/ids';

export interface ReminderRepository {
  save(reminder: Reminder): Promise<void>;
  findPendingByField(fieldId: FieldId): Promise<Reminder[]>;
}
