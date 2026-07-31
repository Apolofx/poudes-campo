import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InMemoryScheduledVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-scheduled-visit-repository';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { InMemoryDataReset } from '@/infrastructure/persistence/in-memory/in-memory-data-reset';
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { CancelVisit } from '@/application/use-cases/cancel-visit';
import { EditVisit } from '@/application/use-cases/edit-visit';
import { GetFieldHistory } from '@/application/use-cases/get-field-history';
import { GetVisit } from '@/application/use-cases/get-visit';
import { ScheduleVisit } from '@/application/use-cases/schedule-visit';
import { CancelScheduledVisit } from '@/application/use-cases/cancel-scheduled-visit';
import { EditScheduledVisit } from '@/application/use-cases/edit-scheduled-visit';
import { GetScheduledVisit } from '@/application/use-cases/get-scheduled-visit';
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
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import type { IdGenerator } from '@/domain/ports/outbound/id-generator';
import type { Container } from '@/composition/container';
import { FixedClock } from './fixed-clock';
import { IncrementingIdGenerator } from './incrementing-id-generator';

/**
 * Builds the catalog slice of a Container (zone/client/field CRUD + clearAllData)
 * over in-memory repos. Shared by makeInMemoryContainer and any test that needs
 * a hand-rolled Container satisfying the full interface.
 */
export function wireCatalogUseCases(
  zones: InMemoryZoneRepository,
  clients: InMemoryClientRepository,
  fields: InMemoryFieldRepository,
  visits: InMemoryVisitRepository,
  reminders: InMemoryReminderRepository,
  scheduledVisits: InMemoryScheduledVisitRepository,
  ids: IdGenerator,
): Pick<
  Container,
  | 'createZone'
  | 'editZone'
  | 'archiveZone'
  | 'restoreZone'
  | 'listZones'
  | 'createClient'
  | 'editClient'
  | 'archiveClient'
  | 'restoreClient'
  | 'listClients'
  | 'createField'
  | 'editField'
  | 'archiveField'
  | 'restoreField'
  | 'listCatalogFields'
  | 'clearAllData'
> {
  const dataReset = new InMemoryDataReset([
    () => zones.clear(),
    () => clients.clear(),
    () => fields.clear(),
    () => visits.clear(),
    () => reminders.clear(),
    () => scheduledVisits.clear(),
  ]);
  return {
    createZone: new CreateZone(zones, ids),
    editZone: new EditZone(zones),
    archiveZone: new ArchiveZone(zones, fields),
    restoreZone: new RestoreZone(zones),
    listZones: new ListZones(zones),
    createClient: new CreateClient(clients, ids),
    editClient: new EditClient(clients),
    archiveClient: new ArchiveClient(clients, fields),
    restoreClient: new RestoreClient(clients),
    listClients: new ListClients(clients),
    createField: new CreateField(fields, ids),
    editField: new EditField(fields),
    archiveField: new ArchiveField(fields),
    restoreField: new RestoreField(fields),
    listCatalogFields: new ListCatalogFields(fields),
    clearAllData: new ClearAllData(dataReset),
  };
}

export function makeInMemoryContainer(now = new Date('2026-07-27T12:00:00Z')): Container {
  const zoneMap = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clientMap = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zoneMap, clientMap, [
    new Field({ id: 'f1', name: 'Lote El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'Lote La Baja', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const zones = new InMemoryZoneRepository(zoneMap);
  const clients = new InMemoryClientRepository(clientMap);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const scheduledVisits = new InMemoryScheduledVisitRepository();
  const clock = new FixedClock(now);
  const ids = new IncrementingIdGenerator();
  const notifier = new InAppReminderNotifier();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, scheduledVisits, clock, ids),
    cancelVisit: new CancelVisit(visits, reminders, clock),
    editVisit: new EditVisit(visits, reminders, clock, ids),
    getFieldHistory: new GetFieldHistory(fields, visits, scheduledVisits),
    getVisit: new GetVisit(visits),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, scheduledVisits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    scheduleVisit: new ScheduleVisit(fields, scheduledVisits, reminders, clock, ids),
    cancelScheduledVisit: new CancelScheduledVisit(scheduledVisits, reminders, clock),
    editScheduledVisit: new EditScheduledVisit(scheduledVisits, reminders, clock, ids),
    getScheduledVisit: new GetScheduledVisit(scheduledVisits),
    reminderAviso: notifier,
    ...wireCatalogUseCases(zones, clients, fields, visits, reminders, scheduledVisits, ids),
  };
}
