import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { SearchFields } from '@/application/use-cases/search-fields';
import { RecordVisit } from '@/application/use-cases/record-visit';
import { ListUpcomingVisits } from '@/application/use-cases/list-upcoming-visits';
import { DispatchDueReminders } from '@/application/use-cases/dispatch-due-reminders';
import { InAppReminderNotifier } from '@/infrastructure/notification/in-app-reminder-notifier';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import type { Container } from '@/composition/container';
import { FixedClock } from './fixed-clock';
import { IncrementingIdGenerator } from './incrementing-id-generator';

export function makeInMemoryContainer(now = new Date('2026-07-27T12:00:00Z')): Container {
  const zones = new Map([['z1', new Zone('z1', 'Norte')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'Lote El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'Lote La Baja', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const clock = new FixedClock(now);
  const reminders = new InMemoryReminderRepository();
  const notifier = new InAppReminderNotifier();
  return {
    searchFields: new SearchFields(fields),
    recordVisit: new RecordVisit(fields, visits, reminders, clock, new IncrementingIdGenerator()),
    listUpcomingVisits: new ListUpcomingVisits(fields, visits, clock),
    dispatchDueReminders: new DispatchDueReminders(reminders, visits, fields, clock, notifier),
    reminderAviso: notifier,
  };
}
