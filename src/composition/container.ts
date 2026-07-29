import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';
import type { ReminderAvisoStore } from '@/domain/ports/outbound/reminder-notifier';
import type { CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

export interface Container {
  searchFields: SearchFields;
  recordVisit: RecordVisit;
  listUpcomingVisits: ListUpcomingVisits;
  dispatchDueReminders: DispatchDueReminders;
  reminderAviso: ReminderAvisoStore;
}

export function buildContainer(db: CampoDb): Container {
  const fields = new IdbFieldRepository(db);
  const visits = new IdbVisitRepository(db);
  const reminders = new IdbReminderRepository(db);
  const clock = new SystemClock();
  const notifier = new InAppReminderNotifier();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, new Uuidv7IdGenerator()),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
  };
}
