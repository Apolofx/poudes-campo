import type { ReminderId, FieldId } from '@/domain/shared/ids';

export interface DueReminder {
  reminderId: ReminderId;
  fieldId: FieldId;
  fieldName: string;
  clientName?: string;
  zoneName?: string;
  nextVisitDate: Date;
  remindAt: Date;
}

export interface ReminderNotifier {
  notify(batch: DueReminder[]): void | Promise<void>;
}

/** Lado de lectura para la UI: expone el último batch notificado. */
export interface ReminderAvisoStore {
  snapshot(): DueReminder[];
}
