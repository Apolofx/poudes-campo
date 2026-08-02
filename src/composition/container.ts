import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { CancelVisit } from '@/application/use-cases/cancel-visit';
import { EditVisit } from '@/application/use-cases/edit-visit';
import { GetFieldHistory } from '@/application/use-cases/get-field-history';
import { GetVisit } from '@/application/use-cases/get-visit';
import { ScheduleVisit } from '@/application/use-cases/schedule-visit';
import { ScheduleVisitEnsuringField } from '@/application/use-cases/schedule-visit-ensuring-field';
import { RecordVisitEnsuringField } from '@/application/use-cases/record-visit-ensuring-field';
import {
  CreateZone,
  EditZone,
  ArchiveZone,
  RestoreZone,
  ListZones,
} from '@/application/use-cases/zone-catalog';
import {
  CreateClient,
  EditClient,
  ArchiveClient,
  RestoreClient,
  ListClients,
} from '@/application/use-cases/client-catalog';
import {
  CreateField,
  EditField,
  ArchiveField,
  RestoreField,
  ListCatalogFields,
} from '@/application/use-cases/field-catalog';
import { ClearAllData } from '@/application/use-cases/clear-all-data';
import { IdbFieldRepository } from '@/infrastructure/persistence/idb/idb-field-repository';
import { IdbVisitRepository } from '@/infrastructure/persistence/idb/idb-visit-repository';
import { IdbReminderRepository } from '@/infrastructure/persistence/idb/idb-reminder-repository';
import { IdbZoneRepository } from '@/infrastructure/persistence/idb/idb-zone-repository';
import { IdbClientRepository } from '@/infrastructure/persistence/idb/idb-client-repository';
import { IdbDataReset } from '@/infrastructure/persistence/idb/idb-data-reset';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { Uuidv7IdGenerator } from '@/infrastructure/id/uuidv7-id-generator';
import type { ReminderAvisoStore } from '@/domain/ports/outbound/reminder-notifier';
import type { CampoDb } from '@/infrastructure/persistence/idb/open-campo-db';

export interface Container {
  searchFields: SearchFields;
  recordVisit: RecordVisit;
  cancelVisit: CancelVisit;
  editVisit: EditVisit;
  getFieldHistory: GetFieldHistory;
  getVisit: GetVisit;
  listUpcomingVisits: ListUpcomingVisits;
  dispatchDueReminders: DispatchDueReminders;
  scheduleVisit: ScheduleVisit;
  scheduleVisitEnsuringField: ScheduleVisitEnsuringField;
  recordVisitEnsuringField: RecordVisitEnsuringField;
  reminderAviso: ReminderAvisoStore;
  createZone: CreateZone;
  editZone: EditZone;
  archiveZone: ArchiveZone;
  restoreZone: RestoreZone;
  listZones: ListZones;
  createClient: CreateClient;
  editClient: EditClient;
  archiveClient: ArchiveClient;
  restoreClient: RestoreClient;
  listClients: ListClients;
  createField: CreateField;
  editField: EditField;
  archiveField: ArchiveField;
  restoreField: RestoreField;
  listCatalogFields: ListCatalogFields;
  clearAllData: ClearAllData;
}

export function buildContainer(db: CampoDb): Container {
  const fields = new IdbFieldRepository(db);
  const visits = new IdbVisitRepository(db);
  const reminders = new IdbReminderRepository(db);
  const zones = new IdbZoneRepository(db);
  const clients = new IdbClientRepository(db);
  const dataReset = new IdbDataReset(db);
  const clock = new SystemClock();
  const ids = new Uuidv7IdGenerator();
  const notifier = new InAppReminderNotifier();
  const createZone = new CreateZone(zones, ids);
  const createClient = new CreateClient(clients, ids);
  const createField = new CreateField(fields, ids);
  const scheduleVisit = new ScheduleVisit(fields, visits, reminders, clock, ids);
  const recordVisit = new RecordVisit(fields, visits, reminders, clock, ids);
  return {
    searchFields: new SearchFields(fields),
    recordVisit,
    cancelVisit: new CancelVisit(visits, reminders, clock),
    editVisit: new EditVisit(visits, reminders, clock, ids),
    getFieldHistory: new GetFieldHistory(fields, visits),
    getVisit: new GetVisit(visits),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    scheduleVisit,
    scheduleVisitEnsuringField: new ScheduleVisitEnsuringField(createZone, createClient, createField, scheduleVisit),
    recordVisitEnsuringField: new RecordVisitEnsuringField(createZone, createClient, createField, recordVisit),
    reminderAviso: notifier,
    createZone,
    editZone: new EditZone(zones),
    archiveZone: new ArchiveZone(zones, fields),
    restoreZone: new RestoreZone(zones),
    listZones: new ListZones(zones),
    createClient,
    editClient: new EditClient(clients),
    archiveClient: new ArchiveClient(clients, fields),
    restoreClient: new RestoreClient(clients),
    listClients: new ListClients(clients),
    createField,
    editField: new EditField(fields),
    archiveField: new ArchiveField(fields),
    restoreField: new RestoreField(fields),
    listCatalogFields: new ListCatalogFields(fields),
    clearAllData: new ClearAllData(dataReset),
  };
}
