import type {
  DueReminder, ReminderNotifier, ReminderAvisoStore,
} from '@/domain/ports/outbound/reminder-notifier';

export class InAppReminderNotifier implements ReminderNotifier, ReminderAvisoStore {
  private last: DueReminder[] = [];

  notify(batch: DueReminder[]): void {
    this.last = batch;
  }

  snapshot(): DueReminder[] {
    return this.last;
  }
}
