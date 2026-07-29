import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { InMemoryZoneRepository } from '@/infrastructure/persistence/in-memory/in-memory-zone-repository';
import { InMemoryClientRepository } from '@/infrastructure/persistence/in-memory/in-memory-client-repository';
import { InMemoryDataReset } from '@/infrastructure/persistence/in-memory/in-memory-data-reset';
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
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
import type { Container } from '@/composition/container';
import { FixedClock } from './fixed-clock';
import { IncrementingIdGenerator } from './incrementing-id-generator';

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
  const clock = new FixedClock(now);
  const ids = new IncrementingIdGenerator();
  const notifier = new InAppReminderNotifier();
  const dataReset = new InMemoryDataReset([
    () => zones.clear(),
    () => clients.clear(),
    () => fields.clear(),
    () => visits.clear(),
    () => reminders.clear(),
  ]);
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, ids),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
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
