import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';
import type { CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

export interface Container {
  searchFields: SearchFields;
  recordVisit: RecordVisit;
  listUpcomingVisits: ListUpcomingVisits;
}

export function buildContainer(db: CampoDb): Container {
  const fields = new IdbFieldRepository(db);
  const visits = new IdbVisitRepository(db);
  const reminders = new IdbReminderRepository(db);
  const clock = new SystemClock();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, new Uuidv7IdGenerator()),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
  };
}
