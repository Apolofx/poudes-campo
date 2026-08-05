import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openCampoDb } from '@/infrastructure/persistence/idb/open-campo-db';
import { IdbDataReset } from '@/infrastructure/persistence/idb/idb-data-reset';

describe('IdbDataReset', () => {
  it('clears every object store', async () => {
    const db = await openCampoDb(`reset-test-${Math.random()}`);
    const now = new Date();
    await db.put('zones', { id: 'z1', name: 'Norte' });
    await db.put('clients', { id: 'c1', name: 'Pérez' });
    await db.put('fields', { id: 'f1', name: 'X', clientId: 'c1', zoneId: 'z1' });
    await db.put('visits', { id: 'v1', fieldId: 'f1', status: 'DONE', visitedAt: now, createdAt: now });
    await db.put('reminders', { id: 'r1', visitId: 'v1', fieldId: 'f1', remindAt: now, status: 'PENDING' });
    await db.put('media', { id: 'm1', visitId: 'v1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3, createdAt: now, blob: new Blob(['abc']) });

    expect(await db.count('zones')).toBe(1);
    expect(await db.count('clients')).toBe(1);
    expect(await db.count('fields')).toBe(1);
    expect(await db.count('visits')).toBe(1);
    expect(await db.count('reminders')).toBe(1);
    expect(await db.count('media')).toBe(1);

    await new IdbDataReset(db).clearAll();

    expect(await db.count('zones')).toBe(0);
    expect(await db.count('clients')).toBe(0);
    expect(await db.count('fields')).toBe(0);
    expect(await db.count('visits')).toBe(0);
    expect(await db.count('reminders')).toBe(0);
    expect(await db.count('media')).toBe(0);

    db.close();
  });
});
