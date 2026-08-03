import { RecordVisit } from '@/application/use-cases/record-visit';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import { InMemoryReminderRepository } from '@/infrastructure/persistence/in-memory/in-memory-reminder-repository';
import { FixedClock } from './fixed-clock';
import { IncrementingIdGenerator } from './incrementing-id-generator';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';

export function makeRecordVisitHarness(now = new Date('2026-07-27T10:00:00Z'), today?: string) {
  const zones = new Map([['z1', new Zone('z1', 'Quiroga')]]);
  const clients = new Map([['c1', new Client('c1', 'Martinez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'Centenario', clientId: 'c1', zoneId: 'z1' }),
  ]);
  const visits = new InMemoryVisitRepository();
  const reminders = new InMemoryReminderRepository();
  const clock = new FixedClock(now, today);
  const ids = new IncrementingIdGenerator('id');
  const uc = new RecordVisit(fields, visits, reminders, clock, ids);
  return { uc, fields, visits, reminders, clock, ids };
}
