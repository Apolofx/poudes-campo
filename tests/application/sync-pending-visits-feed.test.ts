import { describe, it, expect } from 'vitest';
import { SyncPendingVisitsFeed } from '@/application/use-cases/sync-pending-visits-feed';
import { InMemoryFieldRepository } from '@/infrastructure/persistence/in-memory/in-memory-field-repository';
import { InMemoryVisitRepository } from '@/infrastructure/persistence/in-memory/in-memory-visit-repository';
import type { ReminderFeedRepository, PendingVisitFeedItem } from '@/domain/ports/outbound/reminder-feed-repository';
import { Zone } from '@/domain/entities/zone';
import { Client } from '@/domain/entities/client';
import { Field } from '@/domain/entities/field';
import { Visit } from '@/domain/entities/visit';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

class FakeFeed implements ReminderFeedRepository {
  items: PendingVisitFeedItem[] | null = null;

  async replace(items: PendingVisitFeedItem[]): Promise<void> {
    this.items = items;
  }
}

const pending = (id: string, fieldId: string, overrides: Partial<ConstructorParameters<typeof Visit>[0]> = {}) =>
  new Visit({
    id,
    fieldId,
    status: 'PENDING',
    plannedFor: at('2026-08-01'),
    reminderLeadDays: 3,
    createdAt: at('2026-07-01'),
    ...overrides,
  });

function makeSync() {
  const zones = new Map([['z1', new Zone('z1', 'Norte')], ['z2', new Zone('z2', 'Sur')]]);
  const clients = new Map([['c1', new Client('c1', 'Pérez')]]);
  const fields = new InMemoryFieldRepository(zones, clients, [
    new Field({ id: 'f1', name: 'El Alto', clientId: 'c1', zoneId: 'z1' }),
    new Field({ id: 'f2', name: 'La Loma', clientId: 'c1', zoneId: 'z2' }),
    new Field({ id: 'f3', name: 'Archivado', clientId: 'c1', zoneId: 'z2', archived: true }),
  ]);
  const visits = new InMemoryVisitRepository();
  const feed = new FakeFeed();
  const sync = new SyncPendingVisitsFeed(visits, fields, feed);
  return { visits, feed, sync };
}

describe('SyncPendingVisitsFeed', () => {
  it('arma items denormalizados con nombres del catálogo', async () => {
    const { visits, feed, sync } = makeSync();
    await visits.save(pending('p1', 'f1', { notes: 'revisar surco' }));
    await visits.save(pending('p2', 'f2'));

    await sync.execute();

    expect(feed.items).toEqual([
      {
        visitId: 'p1',
        fieldId: 'f1',
        fieldName: 'El Alto',
        clientName: 'Pérez',
        zoneName: 'Norte',
        plannedFor: '2026-08-01T00:00:00.000Z',
        reminderLeadDays: 3,
        notes: 'revisar surco',
      },
      {
        visitId: 'p2',
        fieldId: 'f2',
        fieldName: 'La Loma',
        clientName: 'Pérez',
        zoneName: 'Sur',
        plannedFor: '2026-08-01T00:00:00.000Z',
        reminderLeadDays: 3,
      },
    ]);
  });

  it('sin pendientes reemplaza con lista vacía', async () => {
    const { feed, sync } = makeSync();

    await sync.execute();

    expect(feed.items).toEqual([]);
  });

  it('lote fuera del catálogo cae al fallback "Lote" sin nombres', async () => {
    const { visits, feed, sync } = makeSync();
    await visits.save(pending('p1', 'f999'));

    await sync.execute();

    expect(feed.items).toEqual([
      {
        visitId: 'p1',
        fieldId: 'f999',
        fieldName: 'Lote',
        plannedFor: '2026-08-01T00:00:00.000Z',
        reminderLeadDays: 3,
      },
    ]);
  });

  it('lote archivado conserva su nombre (el catálogo lo incluye)', async () => {
    const { visits, feed, sync } = makeSync();
    await visits.save(pending('p1', 'f3'));

    await sync.execute();

    expect(feed.items?.[0]?.fieldName).toBe('Archivado');
  });
});
